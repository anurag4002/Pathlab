import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { openStore, bootstrap } from "../server/store.js";
import { createApp } from "../server/app.js";

test("MongoDB business workflows, access controls and immutable bills", async (t) => {
  const mongo = await MongoMemoryServer.create();
  const db = await openStore(mongo.getUri(), "portal_workflow_test");
  await bootstrap(db, {
    email: "owner@example.test",
    password: "Owner-test-password-123",
  });
  const server = createApp(db).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.connection.close();
    await mongo.stop();
  });
  async function req(
    path,
    body,
    cookie,
    method = body ? "POST" : "GET",
    origin = base,
  ) {
    const r = await fetch(base + "/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  }
  let owner, cashier, hotel, menu, room, service, bill, booking;
  await t.test(
    "public catalog exposes no staff data; staff area requires login",
    async () => {
      const publicData = await req("/public");
      assert.equal(publicData.status, 200);
      assert.equal(publicData.data.settings.labUrl, "");
      assert.ok(publicData.data.rooms.length);
      assert.equal(publicData.data.settings.taxRate, undefined);
      room = publicData.data.rooms[0];
      service = publicData.data.services[0];
      assert.equal((await req("/bills")).status, 401);
    },
  );
  await t.test(
    "login, account provisioning and module permissions",
    async () => {
      assert.equal(
        (
          await req("/login", {
            email: "owner@example.test",
            password: "wrong",
          })
        ).status,
        401,
      );
      const login = await req("/login", {
        email: "owner@example.test",
        password: "Owner-test-password-123",
      });
      assert.equal(login.status, 200);
      owner = login.cookie;
      assert.ok(owner);
      for (const role of ["cashier", "hotel"])
        assert.equal(
          (
            await req(
              "/users",
              {
                name: role,
                email: `${role}@example.test`,
                password: "Staff-test-password-123",
                role,
              },
              owner,
            )
          ).status,
          201,
        );
      cashier = (
        await req("/login", {
          email: "cashier@example.test",
          password: "Staff-test-password-123",
        })
      ).cookie;
      hotel = (
        await req("/login", {
          email: "hotel@example.test",
          password: "Staff-test-password-123",
        })
      ).cookie;
      assert.equal((await req("/requests/legal", null, cashier)).status, 403);
      assert.equal((await req("/bills", null, hotel)).status, 403);
      assert.equal(
        (await req("/settings", { brand: "Blocked" }, cashier, "PATCH")).status,
        403,
      );
      assert.equal(
        (await req("/settings", { brand: "Blocked" }, hotel, "PATCH")).status,
        403,
      );
      assert.equal(
        (
          await req(
            "/settings",
            { hotelLocation: "Test location" },
            hotel,
            "PATCH",
          )
        ).status,
        200,
      );
      assert.equal(
        (await req("/logout", {}, owner, "POST", "https://elsewhere.test"))
          .status,
        403,
      );
      menu = (await req("/catalog/menu", null, owner)).data;
    },
  );
  await t.test(
    "server-calculated billing, duplicate-safe finalisation and stable snapshots",
    async () => {
      assert.equal(
        (await req("/settings", { taxRate: 5, serviceRate: 2 }, owner, "PATCH"))
          .status,
        200,
      );
      const payload = {
        items: [{ id: menu[0].id, quantity: 2 }],
        discount: 1000,
        payment: "Cash",
        received: 100000,
        name: "Test customer",
        idempotency: randomUUID(),
      };
      const first = await req("/bills", payload, owner);
      assert.equal(first.status, 201);
      bill = first.data;
      const net = menu[0].price * 2 - 1000;
      assert.equal(
        bill.value.total,
        net + Math.round(net * 0.05) + Math.round(net * 0.02),
      );
      const retry = await req("/bills", payload, owner);
      assert.equal(retry.data.id, bill.id);
      assert.equal(await db.Bill.countDocuments(), 1);
      assert.equal(
        (await req("/bills", { ...payload, discount: 0 }, owner)).status,
        409,
      );
      const originalPrice = bill.value.items[0].price;
      assert.equal(
        (
          await req(
            "/catalog/menu/" + menu[0].id,
            { ...menu[0], price: 99999 },
            owner,
            "PATCH",
          )
        ).status,
        200,
      );
      assert.equal(
        (await req("/bills", null, owner)).data[0].value.items[0].price,
        originalPrice,
      );
      assert.equal(
        (
          await req(
            "/bills",
            { ...payload, discount: 1, idempotency: randomUUID() },
            cashier,
          )
        ).status,
        403,
      );
      assert.equal(
        (await req(`/bills/${bill.id}/print`, {}, cashier)).status,
        200,
      );
      assert.equal(await db.Bill.countDocuments(), 1);
      assert.equal(
        (
          await req(
            `/bills/${bill.id}/cancel`,
            { reason: "Not allowed" },
            cashier,
            "PATCH",
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await req(
            `/bills/${bill.id}/cancel`,
            { reason: "Test cancellation" },
            owner,
            "PATCH",
          )
        ).data.status,
        "Cancelled",
      );
      assert.equal(
        (
          await req(
            `/bills/${bill.id}/cancel`,
            { reason: "Again" },
            owner,
            "PATCH",
          )
        ).status,
        409,
      );
    },
  );
  await t.test(
    "hotel dates/capacity, duplicate submissions and manual confirmation",
    async () => {
      const payload = {
        kind: "hotel",
        name: "Hotel test",
        phone: "9876543210",
        email: "",
        roomId: room.id,
        checkIn: "2030-06-12",
        checkOut: "2030-06-14",
        adults: 2,
        children: 0,
        rooms: 1,
        message: "Late arrival",
        idempotency: randomUUID(),
      };
      assert.equal(
        (await req("/public/requests", { ...payload, checkOut: "2030-06-10" }))
          .status,
        400,
      );
      assert.equal(
        (await req("/public/requests", { ...payload, adults: 40 })).status,
        400,
      );
      const first = await req("/public/requests", payload);
      assert.equal(first.status, 201);
      assert.equal(
        (await req("/public/requests", payload)).data.reference,
        first.data.reference,
      );
      assert.equal(await db.Request.countDocuments(), 1);
      booking = (await req("/requests/hotel", null, hotel)).data[0];
      assert.equal(booking.status, "New");
      const updated = await req(
        "/requests/" + booking.id,
        {
          status: "Confirmed",
          rate: 2400,
          note: "Availability checked manually",
        },
        hotel,
        "PATCH",
      );
      assert.equal(updated.status, 200);
      assert.equal(updated.data.value.rate, 2400);
      assert.ok(
        (
          await req("/activity/request/" + booking.id, null, hotel)
        ).data[0].action.includes("checked manually"),
      );
    },
  );
  await t.test(
    "service-specific form validation, honeypot and legal access",
    async () => {
      const payload = {
        kind: "legal",
        name: "Legal test",
        phone: "9876543210",
        serviceId: service.id,
        location: "Lucknow",
        message: "Documentation assistance",
        answers: {},
        idempotency: randomUUID(),
      };
      assert.equal((await req("/public/requests", payload)).status, 400);
      const answers = Object.fromEntries(
        service.fields.map((f) => [f.name, "Test answer"]),
      );
      assert.equal(
        (
          await req("/public/requests", {
            ...payload,
            answers,
            website: "spam",
          })
        ).status,
        400,
      );
      assert.equal(
        (await req("/public/requests", { ...payload, answers })).status,
        201,
      );
      assert.equal((await req("/requests/legal", null, hotel)).status, 403);
      assert.equal((await req("/requests/legal", null, owner)).data.length, 1);
    },
  );
  await t.test("draft persistence and deactivated sessions", async () => {
    assert.equal(
      (
        await req(
          "/draft",
          { cart: [{ id: menu[1].id, quantity: 2 }] },
          cashier,
          "PUT",
        )
      ).status,
      200,
    );
    assert.equal((await req("/draft", null, cashier)).data.cart[0].quantity, 2);
    const user = (await req("/users", null, owner)).data.find(
      (u) => u.role === "cashier",
    );
    assert.equal(
      (await req("/users/" + user.id, { active: false }, owner, "PATCH"))
        .status,
      200,
    );
    assert.equal((await req("/me", null, cashier)).status, 401);
  });
});
