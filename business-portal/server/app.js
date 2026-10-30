import express from "express";
import { createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { checkPassword, hashPassword, nextReference } from "./store.js";

export const statuses = {
  hotel: [
    "New",
    "Contacted",
    "Awaiting response",
    "Confirmed",
    "Declined",
    "Cancelled",
    "Checked in",
    "Checked out",
  ],
  legal: [
    "New",
    "Assigned",
    "Contacted",
    "Awaiting information",
    "In progress",
    "Closed",
  ],
};
const fail = (message, status = 400) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
const str = (v, label, max = 300, required = true) => {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    fail(`${label} is required and must be under ${max} characters.`);
  return v.trim();
};
const optional = (v, label, max) =>
  v == null || v === "" ? "" : str(v, label, max, false);
const number = (v, label, min, max, integer = true) => {
  if (
    typeof v !== "number" ||
    !Number.isFinite(v) ||
    v < min ||
    v > max ||
    (integer && !Number.isInteger(v))
  )
    fail(`Enter a valid ${label} (${min}–${max}).`);
  return v;
};
const id = (v) => {
  if (typeof v !== "string" || !mongoose.isValidObjectId(v))
    fail("Invalid record.");
  return v;
};
const key = (v) => {
  if (typeof v !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(v))
    fail("Missing submission key. Please reload and try again.");
  return v;
};
const fingerprint = (v) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const tokenHash = (t) => createHash("sha256").update(t).digest("hex");
const cleanUser = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active,
});
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const date = (v, label) => {
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    Number.isNaN(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    fail(`Enter a valid ${label}.`);
  return v;
};

export function createApp(db) {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1" || process.env.VERCEL)
    app.set("trust proxy", 1);
  app.use(express.json({ limit: "100kb" }));
  app.use("/api", (req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    });
    if (!["GET", "HEAD"].includes(req.method)) {
      const origin = req.get("origin");
      const allowed = new Set([`${req.protocol}://${req.get("host")}`]);
      if (process.env.APP_ORIGIN) allowed.add(process.env.APP_ORIGIN);
      if (process.env.NODE_ENV !== "production") {
        allowed.add("http://127.0.0.1:5178");
        allowed.add("http://localhost:5178");
      }
      if (!origin || !allowed.has(origin))
        return res
          .status(403)
          .json({ error: "This request must come from the app." });
    }
    next();
  });
  const limiter = (label, limit, duration) => (req, res, next) => {
    const bucket = Math.floor(Date.now() / duration);
    const bucketKey = fingerprint(`${label}:${req.ip}:${bucket}`);
    db.RateBucket.findOneAndUpdate(
      { _id: bucketKey },
      {
        $inc: { count: 1 },
        $setOnInsert: { expires: new Date((bucket + 1) * duration) },
      },
      { upsert: true, new: true },
    )
      .then((value) => {
        if (value.count > limit)
          return res
            .status(429)
            .json({ error: "Too many attempts. Please wait a few minutes." });
        next();
      })
      .catch(next);
  };
  const wrap = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res)).catch(next);
  const auth = (...roles) =>
    wrap(async (req, res) => {
      const cookie = req.headers.cookie
        ?.split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("business_session="))
        ?.slice(17);
      if (!cookie) fail("Please sign in to continue.", 401);
      const session = await db.Session.findOne({
        token: tokenHash(cookie),
        expires: { $gt: new Date() },
      }).populate("user");
      if (!session?.user?.active)
        fail("Your session has expired. Please sign in again.", 401);
      req.user = session.user;
      if (
        roles.length &&
        !roles.includes(req.user.role) &&
        req.user.role !== "owner"
      )
        fail("You do not have access to this area.", 403);
      req.authDone();
    });
  // Adapt the async authentication handler to normal Express middleware.
  const requireUser =
    (...roles) =>
    (req, res, next) => {
      req.authDone = next;
      auth(...roles)(req, res, next);
    };
  const activity = async (req, kind, recordId, action) =>
    db.Activity.create({
      kind,
      recordId: String(recordId),
      actor: req.user?.name || "Visitor",
      action,
    });
  const settings = async () =>
    (await db.Setting.findOne({ key: "business" })).value;
  app.get("/api/health", (_req, res) =>
    res.json({ ok: db.connection.readyState === 1, database: "MongoDB" }),
  );
  app.get(
    "/api/public",
    wrap(async (_req, res) => {
      const s = await settings();
      const {
        taxRate,
        serviceRate,
        receiptRegistration,
        receiptWidth,
        receiptFooter,
        receiptAddress,
        ...publicSettings
      } = s;
      res.json({
        settings: publicSettings,
        rooms: await db.Room.find({ active: true }),
        services: await db.Service.find({ active: true }),
      });
    }),
  );
  app.post(
    "/api/login",
    limiter("login", 20, 10 * 60000),
    wrap(async (req, res) => {
      const email = str(req.body.email, "Email", 180).toLowerCase(),
        password = str(req.body.password, "Password", 200);
      const user = await db.User.findOne({ email, active: true });
      const good = checkPassword(password, user?.password || "placeholder:00");
      if (!user || !good) fail("Email or password is incorrect.", 401);
      const token = randomBytes(32).toString("hex");
      await db.Session.create({
        token: tokenHash(token),
        user: user._id,
        expires: new Date(Date.now() + 12 * 3600000),
      });
      res.cookie("business_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 12 * 3600000,
        path: "/",
      });
      res.json(cleanUser(user));
    }),
  );
  app.get("/api/me", requireUser(), (req, res) =>
    res.json(cleanUser(req.user)),
  );
  app.post(
    "/api/logout",
    requireUser(),
    wrap(async (req, res) => {
      const token = req.headers.cookie
        ?.split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("business_session="))
        ?.slice(17);
      if (token) await db.Session.deleteOne({ token: tokenHash(token) });
      res.clearCookie("business_session", { path: "/" });
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/settings",
    requireUser("owner", "restaurant", "cashier", "hotel"),
    wrap(async (_req, res) => res.json(await settings())),
  );
  app.patch(
    "/api/settings",
    requireUser("owner", "restaurant", "hotel"),
    wrap(async (req, res) => {
      const old = await settings(),
        s = { ...old };
      const allowedKeys =
        req.user.role === "hotel"
          ? [
              "hotelName",
              "hotelLocation",
              "hotelDescription",
              "hotelAmenities",
              "hotelPolicies",
            ]
          : req.user.role === "restaurant"
            ? [
                "restaurant",
                "receiptAddress",
                "receiptRegistration",
                "receiptFooter",
                "receiptWidth",
                "taxRate",
                "serviceRate",
              ]
            : Object.keys(old);
      if (Object.keys(req.body).some((k) => !allowedKeys.includes(k)))
        fail("You can only update settings for your business area.", 403);
      for (const k of Object.keys(old))
        if (req.body[k] !== undefined) {
          if (["taxRate", "serviceRate"].includes(k))
            s[k] = number(req.body[k], k, 0, 100, false);
          else
            s[k] = optional(
              req.body[k],
              k,
              ["intro", "hotelDescription", "hotelPolicies"].includes(k)
                ? 3000
                : 500,
            );
        }
      str(s.brand, "Business name", 100);
      str(s.restaurant, "Restaurant name", 100);
      if (s.labUrl && !/^https?:\/\//i.test(s.labUrl))
        fail("Path Lab URL must start with https:// or http://.");
      if (s.labUrl) {
        try {
          new URL(s.labUrl);
        } catch {
          fail("Enter a valid Path Lab URL.");
        }
      }
      if (!["58", "80"].includes(s.receiptWidth))
        fail("Receipt width must be 58 or 80.");
      await db.Setting.updateOne({ key: "business" }, { $set: { value: s } });
      await activity(req, "settings", "business", "Updated business settings");
      res.json(s);
    }),
  );
  app.get(
    "/api/users",
    requireUser(),
    wrap(async (req, res) => {
      const query =
        req.user.role === "owner"
          ? {}
          : { role: { $in: [req.user.role, "owner"] } };
      res.json((await db.User.find(query)).map(cleanUser));
    }),
  );
  app.post(
    "/api/users",
    requireUser("owner"),
    wrap(async (req, res) => {
      const name = str(req.body.name, "Name", 100),
        email = str(req.body.email, "Email", 180).toLowerCase(),
        password = str(req.body.password, "Password", 200),
        role = req.body.role;
      if (password.length < 12)
        fail("Use a password of at least 12 characters.");
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !["restaurant", "cashier", "hotel", "legal"].includes(role)
      )
        fail("Enter a valid email and staff role.");
      const user = await db.User.create({
        name,
        email,
        password: hashPassword(password),
        role,
      });
      await activity(req, "staff", user.id, "Created staff account");
      res.status(201).json(cleanUser(user));
    }),
  );
  app.patch(
    "/api/users/:id",
    requireUser("owner"),
    wrap(async (req, res) => {
      const user = await db.User.findById(id(req.params.id));
      if (!user) fail("User not found.", 404);
      if (req.body.password !== undefined) {
        if (str(req.body.password, "Password", 200).length < 12)
          fail("Use at least 12 characters.");
        user.password = hashPassword(req.body.password);
      }
      if (req.body.active !== undefined) {
        if (user.role === "owner") fail("The owner cannot be deactivated.");
        user.active = Boolean(req.body.active);
      }
      await user.save();
      await db.Session.deleteMany({ user: user._id });
      await activity(req, "staff", user.id, "Updated access / reset password");
      res.json(cleanUser(user));
    }),
  );
  const catalogModels = { menu: db.Menu, rooms: db.Room, services: db.Service };
  const catalogRoles = {
    menu: ["restaurant", "cashier"],
    rooms: ["hotel"],
    services: ["legal"],
  };
  for (const kind of ["menu", "rooms", "services"]) {
    app.get(
      `/api/catalog/${kind}`,
      requireUser(...catalogRoles[kind]),
      wrap(async (_req, res) =>
        res.json(await catalogModels[kind].find({}).sort({ createdAt: 1 })),
      ),
    );
    const save = wrap(async (req, res) => {
      if (req.user.role === "cashier")
        fail("Only an administrator can change the menu.", 403);
      const value = {
        name: str(req.body.name, "Name", 120),
        active: req.body.active !== false,
      };
      if (kind === "menu")
        Object.assign(value, {
          category: str(req.body.category, "Category", 80),
          price: number(req.body.price, "item price in paise", 0, 10000000),
        });
      if (kind === "rooms") {
        Object.assign(value, {
          description: str(req.body.description, "Description", 3000),
          price: number(req.body.price, "nightly price", 0, 1000000, false),
          occupancy: number(req.body.occupancy, "occupancy", 1, 20),
          amenities: optional(req.body.amenities, "Amenities", 500),
          imageUrl: optional(req.body.imageUrl, "Image URL", 1000),
        });
        if (value.imageUrl && !/^https:\/\//i.test(value.imageUrl))
          fail("Room image URL must start with https://.");
      }
      if (kind === "services") {
        Object.assign(value, {
          category: str(req.body.category, "Category", 80),
          summary: str(req.body.summary, "Summary", 200),
          description: str(req.body.description, "Description", 3000),
        });
        if (!Array.isArray(req.body.fields) || req.body.fields.length > 8)
          fail("Use up to eight service-specific questions.");
        value.fields = req.body.fields.map((f) => ({
          name: str(f.name, "Question", 100),
          required: Boolean(f.required),
        }));
        if (
          new Set(value.fields.map((f) => f.name)).size !== value.fields.length
        )
          fail("Questions must have unique names.");
      }
      const record = req.params.id
        ? await catalogModels[kind].findByIdAndUpdate(
            id(req.params.id),
            { $set: value },
            { new: true },
          )
        : await catalogModels[kind].create(value);
      if (!record) fail("Record not found.", 404);
      await activity(req, kind, record.id, "Updated catalog");
      res.json(record);
    });
    app.post(`/api/catalog/${kind}`, requireUser(...catalogRoles[kind]), save);
    app.patch(
      `/api/catalog/${kind}/:id`,
      requireUser(...catalogRoles[kind]),
      save,
    );
  }
  app.post(
    "/api/public/requests",
    limiter("forms", 25, 10 * 60000),
    wrap(async (req, res) => {
      const b = req.body;
      if (b.website) fail("Unable to accept this submission.");
      if (!["hotel", "legal"].includes(b.kind))
        fail("Choose a valid request type.");
      const idem = key(b.idempotency),
        fp = fingerprint(b);
      const existing = await db.Request.findOne({ idempotency: idem });
      if (existing) {
        if (existing.fingerprint !== fp)
          fail("This submission key has already been used.", 409);
        return res.json({ reference: existing.reference });
      }
      const value = {
        name: str(b.name, "Name", 100),
        phone: str(b.phone, "Phone", 25),
        email: optional(b.email, "Email", 180),
        message: optional(b.message, "Details", 3000),
      };
      if (
        !/^[+\d\s()-]{7,25}$/.test(value.phone) ||
        value.phone.replace(/\D/g, "").length < 7
      )
        fail("Enter a valid contact number.");
      if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))
        fail("Enter a valid email address.");
      if (b.kind === "hotel") {
        const room = await db.Room.findOne({ _id: id(b.roomId), active: true });
        if (!room) fail("This room type is not available for requests.");
        Object.assign(value, {
          roomId: room.id,
          roomName: room.name,
          checkIn: date(b.checkIn, "check-in date"),
          checkOut: date(b.checkOut, "check-out date"),
          adults: number(b.adults, "adults", 1, 40),
          children: number(b.children, "children", 0, 40),
          rooms: number(b.rooms, "room count", 1, 10),
        });
        if (value.checkIn < today() || value.checkOut <= value.checkIn)
          fail(
            "Check-out must be after check-in; check-in cannot be in the past.",
          );
        if (value.adults + value.children > room.occupancy * value.rooms)
          fail("Guest count exceeds the capacity of the selected rooms.");
      } else {
        const svc = await db.Service.findOne({
          _id: id(b.serviceId),
          active: true,
        });
        if (!svc) fail("Please choose an available service.");
        value.serviceId = svc.id;
        value.serviceName = svc.name;
        value.location = str(b.location, "Location", 200);
        value.answers = {};
        str(value.message, "Requirement summary", 3000);
        for (const field of svc.fields)
          value.answers[field.name] = field.required
            ? str(b.answers?.[field.name], field.name, 500)
            : optional(b.answers?.[field.name], field.name, 500);
      }
      const reference = await nextReference(
        db,
        b.kind === "hotel" ? "HTL" : "LEG",
      );
      try {
        await db.Request.create({
          kind: b.kind,
          reference,
          value,
          idempotency: idem,
          fingerprint: fp,
        });
      } catch (e) {
        if (e.code !== 11000) throw e;
        const previous = await db.Request.findOne({ idempotency: idem });
        if (previous?.fingerprint !== fp) fail("Submission conflict.", 409);
        return res.json({ reference: previous.reference });
      }
      res.status(201).json({ reference });
    }),
  );
  app.get(
    "/api/requests/:kind",
    requireUser(),
    wrap(async (req, res) => {
      const kind = req.params.kind;
      if (!statuses[kind]) fail("Unknown app.", 404);
      if (req.user.role !== "owner" && req.user.role !== kind)
        fail("You do not have access to this app.", 403);
      res.json(
        await db.Request.find({ kind }).sort({ createdAt: -1 }).limit(1000),
      );
    }),
  );
  app.patch(
    "/api/requests/:id",
    requireUser(),
    wrap(async (req, res) => {
      const record = await db.Request.findById(id(req.params.id));
      if (!record) fail("Request not found.", 404);
      if (req.user.role !== "owner" && req.user.role !== record.kind)
        fail("You do not have access to this request.", 403);
      const changes = [];
      if (req.body.status !== undefined) {
        if (!statuses[record.kind].includes(req.body.status))
          fail("Choose a valid status.");
        changes.push(`Status: ${record.status} → ${req.body.status}`);
        record.status = req.body.status;
      }
      if (req.body.assignee !== undefined) {
        const uid = req.body.assignee ? id(req.body.assignee) : null;
        if (
          uid &&
          !(await db.User.exists({
            _id: uid,
            active: true,
            role: { $in: ["owner", record.kind] },
          }))
        )
          fail("Choose an active staff member for this app.");
        record.assignee = uid;
        changes.push("Updated assignment");
      }
      const value = { ...record.value };
      if (req.body.rate !== undefined && record.kind === "hotel") {
        value.rate = number(req.body.rate, "agreed rate", 0, 10000000, false);
        changes.push("Updated agreed rate");
      }
      if (req.body.followUp !== undefined) {
        value.followUp = req.body.followUp
          ? date(req.body.followUp, "follow-up date")
          : "";
        changes.push("Updated follow-up date");
      }
      if (req.body.note) {
        changes.push(`Note: ${str(req.body.note, "Note", 2000)}`);
      }
      record.value = value;
      await record.save();
      if (changes.length)
        await activity(req, "request", record.id, changes.join(" | "));
      res.json(record);
    }),
  );
  app.get(
    "/api/activity/:kind/:id",
    requireUser(),
    wrap(async (req, res) => {
      const kind = req.params.kind,
        rid = id(req.params.id);
      const record =
        kind === "request"
          ? await db.Request.findById(rid)
          : kind === "bill"
            ? await db.Bill.findById(rid)
            : null;
      if (!record) fail("Record not found.", 404);
      const allowed =
        kind === "bill" ? ["restaurant", "cashier"] : [record.kind];
      if (req.user.role !== "owner" && !allowed.includes(req.user.role))
        fail("Access denied.", 403);
      res.json(
        await db.Activity.find({ kind, recordId: rid }).sort({ createdAt: -1 }),
      );
    }),
  );
  app.get(
    "/api/bills",
    requireUser("restaurant", "cashier"),
    wrap(async (_req, res) =>
      res.json(await db.Bill.find({}).sort({ createdAt: -1 }).limit(1000)),
    ),
  );
  app.get(
    "/api/draft",
    requireUser("restaurant", "cashier"),
    wrap(async (req, res) =>
      res.json((await db.Draft.findOne({ user: req.user._id }))?.value || null),
    ),
  );
  app.put(
    "/api/draft",
    requireUser("restaurant", "cashier"),
    wrap(async (req, res) => {
      await db.Draft.findOneAndUpdate(
        { user: req.user._id },
        { $set: { value: req.body } },
        { upsert: true },
      );
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/bills",
    requireUser("restaurant", "cashier"),
    wrap(async (req, res) => {
      const b = req.body,
        idem = key(b.idempotency),
        fp = fingerprint({ ...b, cashier: req.user.id });
      const existing = await db.Bill.findOne({ idempotency: idem });
      if (existing) {
        if (existing.fingerprint !== fp)
          fail("This bill key has already been used.", 409);
        return res.json(existing);
      }
      if (!Array.isArray(b.items) || !b.items.length || b.items.length > 100)
        fail("Add at least one item.");
      const ids = b.items.map((i) => id(i.id));
      if (new Set(ids).size !== ids.length)
        fail("Combine duplicate menu items.");
      const menu = await db.Menu.find({ _id: { $in: ids }, active: true });
      const items = b.items.map((i) => {
        const m = menu.find((m) => m.id === i.id);
        if (!m) fail("An item is no longer available. Refresh the menu.");
        const quantity = number(i.quantity, "quantity", 1, 100);
        return {
          id: m.id,
          name: m.name,
          category: m.category,
          price: m.price,
          quantity,
          total: m.price * quantity,
        };
      });
      const subtotal = items.reduce((a, i) => a + i.total, 0),
        discount = number(b.discount || 0, "discount in paise", 0, subtotal);
      if (discount && req.user.role === "cashier")
        fail("An administrator must apply discounts.", 403);
      const s = await settings(),
        net = subtotal - discount,
        tax = Math.round((net * s.taxRate) / 100),
        charge = Math.round((net * s.serviceRate) / 100),
        total = net + tax + charge;
      if (!["Cash", "UPI", "Card"].includes(b.payment))
        fail("Choose a payment method.");
      const received =
        b.payment === "Cash"
          ? number(b.received, "cash received in paise", total, 100000000)
          : total;
      const value = {
        items,
        subtotal,
        discount,
        tax,
        charge,
        total,
        received,
        change: received - total,
        payment: b.payment,
        name: optional(b.name, "Customer name", 100),
        phone: optional(b.phone, "Customer phone", 25),
        reference: optional(b.reference, "Reference", 100),
        cashier: req.user.name,
        receipt: {
          name: s.restaurant,
          address: s.receiptAddress,
          registration: s.receiptRegistration,
          footer: s.receiptFooter,
          width: s.receiptWidth,
          taxRate: s.taxRate,
          serviceRate: s.serviceRate,
        },
      };
      let record;
      try {
        record = await db.Bill.create({
          reference: await nextReference(db, "BILL"),
          value,
          cashier: req.user._id,
          idempotency: idem,
          fingerprint: fp,
        });
      } catch (e) {
        if (e.code !== 11000) throw e;
        record = await db.Bill.findOne({ idempotency: idem });
        if (record?.fingerprint !== fp) fail("Bill conflict.", 409);
      }
      await db.Draft.deleteOne({ user: req.user._id });
      await activity(req, "bill", record.id, "Finalised bill");
      res.status(201).json(record);
    }),
  );
  app.patch(
    "/api/bills/:id/cancel",
    requireUser("restaurant"),
    wrap(async (req, res) => {
      const reason = str(req.body.reason, "Cancellation reason", 500);
      const bill = await db.Bill.findOneAndUpdate(
        { _id: id(req.params.id), status: "Finalised" },
        { $set: { status: "Cancelled", cancelReason: reason } },
        { new: true },
      );
      if (!bill) fail("Bill not found or already cancelled.", 409);
      await activity(req, "bill", bill.id, `Cancelled: ${reason}`);
      res.json(bill);
    }),
  );
  app.post(
    "/api/bills/:id/print",
    requireUser("restaurant", "cashier"),
    wrap(async (req, res) => {
      const bill = await db.Bill.findById(id(req.params.id));
      if (!bill) fail("Bill not found.", 404);
      await activity(
        req,
        "bill",
        bill.id,
        "Opened receipt print dialog (paper output not verified)",
      );
      res.json({ ok: true });
    }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  app.use((e, _req, res, _next) => {
    const code =
      e.status ||
      (e.code === 11000 ? 409 : e.name === "ValidationError" ? 400 : 500);
    if (code === 500) console.error(e.message);
    res.status(code).json({
      error:
        e.code === 11000
          ? "This record already exists."
          : code === 500
            ? "Something went wrong. Please try again."
            : e.message,
    });
  });
  return app;
}
