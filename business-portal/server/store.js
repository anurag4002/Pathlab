import mongoose from "mongoose";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function checkPassword(password, hash) {
  try {
    const [salt, stored] = hash.split(":");
    return timingSafeEqual(
      scryptSync(password, salt, 64),
      Buffer.from(stored, "hex"),
    );
  } catch {
    return false;
  }
}
export async function openStore(uri, database = "business_portal") {
  const connection = await mongoose
    .createConnection(uri, {
      dbName: database,
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 5,
      minPoolSize: 0,
    })
    .asPromise();
  const schema = (fields) =>
    new mongoose.Schema(fields, {
      timestamps: true,
      toJSON: {
        transform: (_doc, ret) => {
          ret.id = String(ret._id);
          delete ret._id;
          delete ret.__v;
          return ret;
        },
      },
    });
  const ref = mongoose.Schema.Types.ObjectId;
  const models = {
    User: connection.model(
      "User",
      schema({
        name: String,
        email: { type: String, unique: true },
        password: String,
        role: {
          type: String,
          enum: ["owner", "restaurant", "cashier", "hotel", "legal"],
        },
        active: { type: Boolean, default: true },
      }),
    ),
    Session: connection.model(
      "Session",
      schema({
        token: { type: String, unique: true },
        user: { type: ref, ref: "User" },
        expires: { type: Date, expires: 0 },
      }),
    ),
    Setting: connection.model(
      "Setting",
      schema({
        key: { type: String, unique: true },
        value: mongoose.Schema.Types.Mixed,
      }),
    ),
    Menu: connection.model(
      "Menu",
      schema({
        name: String,
        category: String,
        price: Number,
        active: { type: Boolean, default: true },
      }),
    ),
    Room: connection.model(
      "Room",
      schema({
        name: String,
        description: String,
        price: Number,
        occupancy: Number,
        amenities: String,
        imageUrl: String,
        active: { type: Boolean, default: true },
      }),
    ),
    Service: connection.model(
      "Service",
      schema({
        name: String,
        category: String,
        summary: String,
        description: String,
        fields: [{ name: String, required: Boolean }],
        active: { type: Boolean, default: true },
      }),
    ),
    Request: connection.model(
      "Request",
      schema({
        kind: String,
        reference: { type: String, unique: true },
        value: mongoose.Schema.Types.Mixed,
        status: { type: String, default: "New" },
        assignee: { type: ref, ref: "User", default: null },
        idempotency: { type: String, unique: true },
        fingerprint: String,
      }),
    ),
    Bill: connection.model(
      "Bill",
      schema({
        reference: { type: String, unique: true },
        value: mongoose.Schema.Types.Mixed,
        status: { type: String, default: "Finalised" },
        cashier: { type: ref, ref: "User" },
        idempotency: { type: String, unique: true },
        fingerprint: String,
        cancelReason: String,
      }),
    ),
    Draft: connection.model(
      "Draft",
      schema({
        user: { type: ref, unique: true },
        value: mongoose.Schema.Types.Mixed,
      }),
    ),
    Activity: connection.model(
      "Activity",
      schema({ kind: String, recordId: String, actor: String, action: String }),
    ),
    Counter: connection.model(
      "Counter",
      new mongoose.Schema({ _id: String, value: Number }),
    ),
    RateBucket: connection.model(
      "RateBucket",
      new mongoose.Schema({
        _id: String,
        count: Number,
        expires: { type: Date, expires: 0 },
      }),
    ),
  };
  await Promise.all(Object.values(models).map((model) => model.init()));
  return { ...models, connection };
}
export async function nextReference(db, kind) {
  const c = await db.Counter.findOneAndUpdate(
    { _id: kind },
    { $inc: { value: 1 } },
    { upsert: true, new: true },
  );
  return `${kind}-${String(c.value).padStart(5, "0")}`;
}
export async function bootstrap(db, options = {}) {
  if (!(await db.Setting.exists({ key: "business" })))
    await db.Setting.create({
      key: "business",
      value: {
        brand: "Business Hub",
        tagline: "Everyday services. One trusted destination.",
        intro:
          "Find your next stay, get the right legal assistance, or manage your restaurant. Everything starts here.",
        phone: "",
        email: "",
        address: "",
        labUrl: "",
        restaurant: "The Dining Room",
        receiptAddress: "",
        receiptRegistration: "",
        receiptFooter: "Thank you. We look forward to serving you again.",
        receiptWidth: "80",
        taxRate: 0,
        serviceRate: 0,
        hotelName: "The Residence",
        hotelLocation: "Location to be confirmed",
        hotelDescription:
          "A comfortable place to pause. Explore our room options and send a stay request. Our team will personally confirm availability and the final price.",
        hotelAmenities: "Wi-Fi,Parking,Room service,Air conditioning",
        hotelPolicies:
          "Availability, check-in and cancellation terms will be confirmed by our team.",
      },
    });
  if (options.seedCatalog !== false && !(await db.Menu.exists({})))
    await db.Menu.insertMany(
      [
        ["Paneer Tikka", "Starters", 26000],
        ["Vegetable Spring Rolls", "Starters", 18000],
        ["Crispy Corn", "Starters", 19000],
        ["Dal Makhani", "Main course", 24000],
        ["Paneer Butter Masala", "Main course", 28000],
        ["Vegetable Biryani", "Main course", 22000],
        ["Butter Naan", "Breads", 4500],
        ["Tandoori Roti", "Breads", 2500],
        ["Fresh Lime Soda", "Beverages", 8000],
        ["Masala Chai", "Beverages", 5000],
        ["Gulab Jamun", "Desserts", 9000],
        ["Vanilla Ice Cream", "Desserts", 10000],
      ].map(([name, category, price]) => ({ name, category, price })),
    );
  if (options.seedCatalog !== false && !(await db.Room.exists({})))
    await db.Room.insertMany([
      {
        name: "Classic Room",
        description:
          "A thoughtfully arranged room for a restful stay, with a comfortable double bed and a private bathroom.",
        price: 2200,
        occupancy: 2,
        amenities: "Double bed,Wi-Fi,Air conditioning",
      },
      {
        name: "Deluxe Room",
        description:
          "A little more room to unwind. A spacious layout, a king bed and a dedicated seating area.",
        price: 3200,
        occupancy: 3,
        amenities: "King bed,Seating area,Wi-Fi",
      },
      {
        name: "Family Suite",
        description:
          "Space for everyone, with generous sleeping arrangements and a comfortable place to spend time together.",
        price: 4800,
        occupancy: 4,
        amenities: "Family beds,Lounge area,Wi-Fi",
      },
    ]);
  if (options.seedCatalog !== false && !(await db.Service.exists({})))
    await db.Service.insertMany([
      {
        name: "Property & Documentation",
        category: "Property",
        summary: "Clarity for your next property decision.",
        description:
          "Share your property documentation or transaction requirements. Our team will review your enquiry and explain the assistance available, the next steps and any applicable fees.",
        fields: [
          { name: "Property location", required: true },
          { name: "Type of assistance", required: true },
        ],
      },
      {
        name: "Business Registration",
        category: "Business",
        summary: "A confident start for your business.",
        description:
          "Tell us about the business you want to establish. We will contact you to discuss suitable registration assistance and the information required.",
        fields: [
          { name: "Business activity", required: true },
          { name: "Proposed business name", required: false },
        ],
      },
      {
        name: "Agreements & Contracts",
        category: "Documentation",
        summary: "Make your agreements clear and considered.",
        description:
          "Request assistance with drafting or reviewing an agreement. Describe the document and your requirements so our team can arrange a follow-up.",
        fields: [{ name: "Agreement type", required: true }],
      },
      {
        name: "Legal Consultation",
        category: "Consultation",
        summary: "Start with a conversation about your situation.",
        description:
          "Outline the assistance you need. Our team will get in touch to understand the matter and discuss an appropriate consultation.",
        fields: [{ name: "Preferred contact time", required: false }],
      },
    ]);
  if (await db.User.exists({ role: "owner" })) return null;
  const credentials = {
    email: options.email || "owner@business.local",
    password: options.password || randomBytes(15).toString("base64url"),
  };
  await db.User.create({
    name: "Owner",
    email: credentials.email,
    password: hashPassword(credentials.password),
    role: "owner",
  });
  return credentials;
}
