import { db } from "./client";
import { estateCities } from "./schema/estate";

const cities = [
  { name: "Karachi", province: "Sindh", isPopular: true },
  { name: "Lahore", province: "Punjab", isPopular: true },
  { name: "Islamabad", province: "Islamabad Capital Territory", isPopular: true },
  { name: "Rawalpindi", province: "Punjab", isPopular: true },
  { name: "Faisalabad", province: "Punjab", isPopular: true },
  { name: "Peshawar", province: "Khyber Pakhtunkhwa", isPopular: true },
  { name: "Quetta", province: "Balochistan", isPopular: true },
  { name: "Multan", province: "Punjab", isPopular: true },
  { name: "Sialkot", province: "Punjab", isPopular: false },
  { name: "Gujranwala", province: "Punjab", isPopular: false },
  { name: "Hyderabad", province: "Sindh", isPopular: false },
  { name: "Gwadar", province: "Balochistan", isPopular: false },
  { name: "Abbottabad", province: "Khyber Pakhtunkhwa", isPopular: false },
  { name: "Bahawalpur", province: "Punjab", isPopular: false },
  { name: "Sargodha", province: "Punjab", isPopular: false },
  { name: "Sukkur", province: "Sindh", isPopular: false },
  { name: "Larkana", province: "Sindh", isPopular: false },
  { name: "Sheikhupura", province: "Punjab", isPopular: false },
  { name: "Rahim Yar Khan", province: "Punjab", isPopular: false },
  { name: "Jhang", province: "Punjab", isPopular: false },
  { name: "Dera Ghazi Khan", province: "Punjab", isPopular: false },
  { name: "Mirpur Khas", province: "Sindh", isPopular: false },
  { name: "Nawabshah", province: "Sindh", isPopular: false },
  { name: "Kasur", province: "Punjab", isPopular: false },
  { name: "Mardan", province: "Khyber Pakhtunkhwa", isPopular: false },
  { name: "Mingora", province: "Khyber Pakhtunkhwa", isPopular: false },
  { name: "Chiniot", province: "Punjab", isPopular: false },
  { name: "Jhelum", province: "Punjab", isPopular: false },
  { name: "Khanewal", province: "Punjab", isPopular: false },
  { name: "Hafizabad", province: "Punjab", isPopular: false },
  { name: "Kohat", province: "Khyber Pakhtunkhwa", isPopular: false },
  { name: "Muzaffarabad", province: "Azad Kashmir", isPopular: false },
  { name: "Mirpur", province: "Azad Kashmir", isPopular: false },
  { name: "Turbat", province: "Balochistan", isPopular: false },
  { name: "Hub", province: "Balochistan", isPopular: false },
  { name: "Attock", province: "Punjab", isPopular: false },
  { name: "Mansehra", province: "Khyber Pakhtunkhwa", isPopular: false },
];

async function seedCities() {
  console.log("Seeding estate cities...");
  await db.insert(estateCities).values(cities).onConflictDoNothing();
  console.log(`Seeded ${cities.length} Pakistan cities ✓`);
}

seedCities()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
