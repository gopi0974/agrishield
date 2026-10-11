export type View =
  | "Overview"
  | "Soil & crop recommendations"
  | "Crop calendar"
  | "Harvest & market prices"
  | "Storage locations"
  | "My farm"
  | "Settings";

export type CropKey =
  | "Rice" | "Maize" | "Groundnut" | "Cotton" | "Green gram"
  | "Chickpea" | "Kidney beans" | "Pigeon peas" | "Moth beans" | "Mung bean"
  | "Black gram" | "Lentil" | "Pomegranate" | "Banana" | "Mango"
  | "Grapes" | "Watermelon" | "Muskmelon" | "Apple" | "Orange"
  | "Papaya" | "Coconut" | "Jute" | "Coffee";

export interface CropInfo {
  name: CropKey;
  variety: string;
  days: number;
  water: string;
  soil: string;
  season: string;
  pricePerQuintal: number;
  image: string;
  explanation: string;
  stages: { name: string; day: number }[];
}

export interface Activity {
  id: string;
  title: string;
  stage: string;
  day: number;
  duration?: number;
  description: string;
}

export interface Facility {
  id: string;
  name: string;
  type: string;
  crops: CropKey[];
  capacity: number;
  charge: number;
  contact: string;
  sampleDistrict: string;
  distance: number;
  description: string;
  country: string;
  state: string;
  locality: string;
  address: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  condition: "Excellent" | "Good" | "Needs Maintenance" | "Critical";
  cleanliness: string;
  ventilation: string;
  moistureProtection: string;
  pestControl: string;
  inspectionDate: string;
  maintenanceNotes: string;
  availability: "Available" | "Limited Availability" | "Unavailable";
  occupiedCapacity: number;
  capacityUnit: "tonnes" | "kilograms";
  dailyPrice: number;
  pricingUnit: "per tonne per day" | "per kilogram per day" | "per facility per day";
  minimumDays: number;
  handlingFee: number;
  loadingFee: number;
  pricingNotes: string;
  availabilityNotes: string;
  devices: MonitoringDevice[];
  updatedAt: string;
  providerManaged: boolean;
}

export interface MonitoringDevice {
  id: string;
  name: string;
  type: "Temperature Sensor" | "Humidity Sensor" | "Combined Temperature & Humidity Sensor";
  identifier: string;
  area: string;
  status: "Online" | "Offline" | "Maintenance";
  enabled: boolean;
  temperature: number | null;
  humidity: number | null;
  temperatureThreshold: number;
  humidityThreshold: number;
  updatedAt: string;
}

export interface RevenueSummary {
  saleableQuintals: number;
  grossRevenue: number;
  totalCosts: number;
  netReturn: number;
}

export const crops: CropInfo[] = [
  {
    name: "Rice",
    variety: "Sona Masuri (demo variety)",
    days: 125,
    water: "High",
    soil: "Clay loam, pH 5.5-7.0",
    season: "Kharif · Jun to Jul",
    pricePerQuintal: 2280,
    image: "https://images.unsplash.com/photo-1536054985673-4be47ef991d4?w=600&auto=format&fit=crop",
    explanation: "Sample fit for moisture-retentive soil and reliable irrigation.",
    stages: [
      { name: "Land preparation", day: 0 },
      { name: "Establishment", day: 18 },
      { name: "Tillering", day: 42 },
      { name: "Flowering", day: 78 },
      { name: "Grain filling", day: 101 },
      { name: "Harvest window", day: 125 },
    ],
  },
  {
    name: "Maize",
    variety: "HQPM-1 (demo variety)",
    days: 100,
    water: "Medium",
    soil: "Well-drained loam, pH 5.8-7.2",
    season: "Kharif · Jun to Jul",
    pricePerQuintal: 2140,
    image: "https://images.unsplash.com/photo-1601593346740-925612772716?w=600&auto=format&fit=crop",
    explanation: "Sample fit for well-drained soil with moderate water access.",
    stages: [
      { name: "Land preparation", day: 0 },
      { name: "Germination", day: 8 },
      { name: "Vegetative growth", day: 32 },
      { name: "Tasseling", day: 55 },
      { name: "Kernel development", day: 76 },
      { name: "Harvest window", day: 100 },
    ],
  },
  {
    name: "Groundnut",
    variety: "Kadiri-6 (demo variety)",
    days: 105,
    water: "Low to medium",
    soil: "Loose sandy loam, pH 6.0-7.0",
    season: "Kharif · Jun to Jul",
    pricePerQuintal: 5820,
    image: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&auto=format&fit=crop",
    explanation: "Sample fit for loose, well-drained soil and moderate rainfall.",
    stages: [
      { name: "Seedbed preparation", day: 0 },
      { name: "Emergence", day: 10 },
      { name: "Flowering", day: 32 },
      { name: "Pegging", day: 48 },
      { name: "Pod development", day: 76 },
      { name: "Harvest window", day: 105 },
    ],
  },
  {
    name: "Cotton",
    variety: "Suraj (demo variety)",
    days: 160,
    water: "Medium",
    soil: "Deep black soil, pH 6.0-8.0",
    season: "Kharif · May to Jun",
    pricePerQuintal: 7120,
    image: "https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=600&auto=format&fit=crop",
    explanation: "Sample fit for deep soils that can retain moisture between checks.",
    stages: [
      { name: "Field preparation", day: 0 },
      { name: "Emergence", day: 12 },
      { name: "Vegetative growth", day: 48 },
      { name: "Flowering", day: 82 },
      { name: "Boll development", day: 122 },
      { name: "Picking window", day: 160 },
    ],
  },
  {
    name: "Green gram",
    variety: "ML-818 (demo variety)",
    days: 70,
    water: "Low",
    soil: "Well-drained loam, pH 6.2-7.5",
    season: "Kharif · Jun to Jul",
    pricePerQuintal: 7420,
    image: "https://images.unsplash.com/photo-1628352081506-83c43123ed6d?w=600&auto=format&fit=crop",
    explanation: "Sample fit for a shorter season and lower water availability.",
    stages: [
      { name: "Field preparation", day: 0 },
      { name: "Emergence", day: 7 },
      { name: "Branching", day: 22 },
      { name: "Flowering", day: 38 },
      { name: "Pod filling", day: 54 },
      { name: "Harvest window", day: 70 },
    ],
  },
  {
    name: "Chickpea",
    variety: "Desi type (demo variety)",
    days: 95,
    water: "Low",
    soil: "Well-drained sandy loam, pH 6.0-7.5",
    season: "Rabi · Oct to Nov",
    pricePerQuintal: 5200,
    image: "https://images.unsplash.com/photo-1612257416648-2d3b5c1e4b1a?w=600&auto=format&fit=crop",
    explanation: "Sample fit for cool dry conditions and low-water soils.",
    stages: [
      { name: "Field preparation", day: 0 },
      { name: "Emergence", day: 8 },
      { name: "Vegetative growth", day: 28 },
      { name: "Flowering", day: 45 },
      { name: "Pod filling", day: 68 },
      { name: "Harvest window", day: 95 },
    ],
  },
  {
    name: "Kidney beans",
    variety: "Local red (demo variety)",
    days: 90,
    water: "Medium",
    soil: "Loam, pH 6.0-7.0",
    season: "Kharif · Jun to Jul",
    pricePerQuintal: 8500,
    image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&auto=format&fit=crop",
    explanation: "Sample fit for moderate rainfall and well-structured loam soils.",
    stages: [
      { name: "Field preparation", day: 0 },
      { name: "Emergence", day: 7 },
      { name: "Vegetative growth", day: 25 },
      { name: "Flowering", day: 42 },
      { name: "Pod development", day: 65 },
      { name: "Harvest window", day: 90 },
    ],
  },
  {
    name: "Pigeon peas",
    variety: "ICPH-2671 (demo variety)",
    days: 150,
    water: "Low to medium",
    soil: "Well-drained loam, pH 6.0-7.5",
    season: "Kharif · Jun to Jul",
    pricePerQuintal: 6800,
    image: "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=600&auto=format&fit=crop",
    explanation: "Sample fit for dryland farming with moderate fertility soils.",
    stages: [
      { name: "Field preparation", day: 0 },
      { name: "Emergence", day: 10 },
      { name: "Vegetative growth", day: 40 },
      { name: "Flowering", day: 80 },
      { name: "Pod filling", day: 120 },
      { name: "Harvest window", day: 150 },
    ],
  },
  {
    name: "Moth beans",
    variety: "RMO-40 (demo variety)",
    days: 75,
    water: "Low",
    soil: "Sandy loam, pH 6.5-8.0",
    season: "Kharif · Jun to Jul",
    pricePerQuintal: 6200,
    image: "https://images.unsplash.com/photo-1628352081506-83c43123ed6d?w=600&auto=format&fit=crop",
    explanation: "Sample fit for arid and semi-arid conditions with sandy soils.",
    stages: [
      { name: "Field preparation", day: 0 },
      { name: "Emergence", day: 6 },
      { name: "Branching", day: 20 },
      { name: "Flowering", day: 38 },
      { name: "Pod filling", day: 58 },
      { name: "Harvest window", day: 75 },
    ],
  },
  {
    name: "Mung bean",
    variety: "Pusa Vishal (demo variety)",
    days: 65,
    water: "Low",
    soil: "Sandy loam, pH 6.2-7.2",
    season: "Kharif · Jun to Jul",
    pricePerQuintal: 7800,
    image: "https://images.unsplash.com/photo-1628352081506-83c43123ed6d?w=600&auto=format&fit=crop",
    explanation: "Sample fit for short-season warm conditions with low water needs.",
    stages: [
      { name: "Field preparation", day: 0 },
      { name: "Emergence", day: 5 },
      { name: "Branching", day: 18 },
      { name: "Flowering", day: 35 },
      { name: "Pod filling", day: 50 },
      { name: "Harvest window", day: 65 },
    ],
  },
  {
    name: "Black gram",
    variety: "T-9 (demo variety)",
    days: 75,
    water: "Low to medium",
    soil: "Loam to clay loam, pH 6.0-7.5",
    season: "Kharif · Jun to Jul",
    pricePerQuintal: 7600,
    image: "https://images.unsplash.com/photo-1628352081506-83c43123ed6d?w=600&auto=format&fit=crop",
    explanation: "Sample fit for warm humid conditions and moderate fertility soils.",
    stages: [
      { name: "Field preparation", day: 0 },
      { name: "Emergence", day: 6 },
      { name: "Branching", day: 20 },
      { name: "Flowering", day: 38 },
      { name: "Pod filling", day: 58 },
      { name: "Harvest window", day: 75 },
    ],
  },
  {
    name: "Lentil",
    variety: "Pant L-406 (demo variety)",
    days: 110,
    water: "Low",
    soil: "Loam, pH 6.0-8.0",
    season: "Rabi · Oct to Nov",
    pricePerQuintal: 5800,
    image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&auto=format&fit=crop",
    explanation: "Sample fit for cool dry Rabi season with low water input.",
    stages: [
      { name: "Field preparation", day: 0 },
      { name: "Emergence", day: 8 },
      { name: "Vegetative growth", day: 30 },
      { name: "Flowering", day: 55 },
      { name: "Pod filling", day: 80 },
      { name: "Harvest window", day: 110 },
    ],
  },
  {
    name: "Pomegranate",
    variety: "Bhagwa (demo variety)",
    days: 180,
    water: "Low to medium",
    soil: "Well-drained loam, pH 5.5-7.5",
    season: "Perennial · planted Feb to Mar",
    pricePerQuintal: 9500,
    image: "https://images.unsplash.com/photo-1541344999736-83eca272f6fc?w=600&auto=format&fit=crop",
    explanation: "Sample fit for semi-arid conditions with drip irrigation.",
    stages: [
      { name: "Planting / pruning", day: 0 },
      { name: "New growth", day: 20 },
      { name: "Flowering", day: 60 },
      { name: "Fruit set", day: 90 },
      { name: "Fruit development", day: 130 },
      { name: "Harvest window", day: 180 },
    ],
  },
  {
    name: "Banana",
    variety: "Grand Naine (demo variety)",
    days: 300,
    water: "High",
    soil: "Rich loam, pH 6.0-7.5",
    season: "Perennial · planted Jun to Jul",
    pricePerQuintal: 2200,
    image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&auto=format&fit=crop",
    explanation: "Sample fit for tropical humid conditions with reliable irrigation.",
    stages: [
      { name: "Planting", day: 0 },
      { name: "Establishment", day: 30 },
      { name: "Vegetative growth", day: 90 },
      { name: "Shooting", day: 200 },
      { name: "Bunch development", day: 250 },
      { name: "Harvest window", day: 300 },
    ],
  },
  {
    name: "Mango",
    variety: "Alphonso (demo variety)",
    days: 120,
    water: "Low to medium",
    soil: "Deep loam, pH 5.5-7.5",
    season: "Perennial · flowers Dec to Jan",
    pricePerQuintal: 6000,
    image: "https://images.unsplash.com/photo-1553279768-865429fa0078?w=600&auto=format&fit=crop",
    explanation: "Sample fit for tropical dry season flowering and warm summers.",
    stages: [
      { name: "Flowering", day: 0 },
      { name: "Fruit set", day: 20 },
      { name: "Fruit development", day: 60 },
      { name: "Ripening", day: 100 },
      { name: "Harvest window", day: 120 },
    ],
  },
  {
    name: "Grapes",
    variety: "Thompson Seedless (demo variety)",
    days: 150,
    water: "Medium",
    soil: "Well-drained loam, pH 6.0-7.0",
    season: "Perennial · pruned Jan to Feb",
    pricePerQuintal: 5500,
    image: "https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=600&auto=format&fit=crop",
    explanation: "Sample fit for warm dry conditions with drip irrigation.",
    stages: [
      { name: "Pruning", day: 0 },
      { name: "Bud burst", day: 15 },
      { name: "Flowering", day: 45 },
      { name: "Berry development", day: 80 },
      { name: "Veraison", day: 120 },
      { name: "Harvest window", day: 150 },
    ],
  },
  {
    name: "Watermelon",
    variety: "Sugar Baby (demo variety)",
    days: 80,
    water: "Medium",
    soil: "Sandy loam, pH 6.0-7.0",
    season: "Summer · Feb to Mar",
    pricePerQuintal: 1800,
    image: "https://images.unsplash.com/photo-1589984662646-e7b2e4962f18?w=600&auto=format&fit=crop",
    explanation: "Sample fit for warm sandy soils with moderate irrigation.",
    stages: [
      { name: "Field preparation", day: 0 },
      { name: "Germination", day: 7 },
      { name: "Vine growth", day: 25 },
      { name: "Flowering", day: 40 },
      { name: "Fruit development", day: 60 },
      { name: "Harvest window", day: 80 },
    ],
  },
  {
    name: "Muskmelon",
    variety: "Hara Madhu (demo variety)",
    days: 75,
    water: "Medium",
    soil: "Sandy loam, pH 6.0-7.0",
    season: "Summer · Feb to Mar",
    pricePerQuintal: 2000,
    image: "https://images.unsplash.com/photo-1571680322279-a226e6a4cc2a?w=600&auto=format&fit=crop",
    explanation: "Sample fit for warm dry conditions with moderate water supply.",
    stages: [
      { name: "Field preparation", day: 0 },
      { name: "Germination", day: 6 },
      { name: "Vine growth", day: 22 },
      { name: "Flowering", day: 38 },
      { name: "Fruit development", day: 58 },
      { name: "Harvest window", day: 75 },
    ],
  },
  {
    name: "Apple",
    variety: "Royal Delicious (demo variety)",
    days: 160,
    water: "Medium",
    soil: "Well-drained loam, pH 5.5-6.5",
    season: "Perennial · flowers Mar to Apr",
    pricePerQuintal: 8000,
    image: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop",
    explanation: "Sample fit for cool temperate hills with chilling requirement met.",
    stages: [
      { name: "Flowering", day: 0 },
      { name: "Fruit set", day: 20 },
      { name: "June drop", day: 50 },
      { name: "Fruit development", day: 90 },
      { name: "Colour development", day: 140 },
      { name: "Harvest window", day: 160 },
    ],
  },
  {
    name: "Orange",
    variety: "Nagpur Mandarin (demo variety)",
    days: 240,
    water: "Medium",
    soil: "Well-drained loam, pH 6.0-7.5",
    season: "Perennial · flowers Feb to Mar",
    pricePerQuintal: 3500,
    image: "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=600&auto=format&fit=crop",
    explanation: "Sample fit for sub-tropical conditions with mild winters.",
    stages: [
      { name: "Flowering", day: 0 },
      { name: "Fruit set", day: 30 },
      { name: "Fruit development", day: 90 },
      { name: "Colour change", day: 180 },
      { name: "Ripening", day: 220 },
      { name: "Harvest window", day: 240 },
    ],
  },
  {
    name: "Papaya",
    variety: "Red Lady (demo variety)",
    days: 270,
    water: "Medium",
    soil: "Well-drained loam, pH 6.0-7.0",
    season: "Perennial · planted Jun to Jul",
    pricePerQuintal: 2500,
    image: "https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=600&auto=format&fit=crop",
    explanation: "Sample fit for tropical conditions with no waterlogging.",
    stages: [
      { name: "Planting", day: 0 },
      { name: "Establishment", day: 30 },
      { name: "Vegetative growth", day: 80 },
      { name: "Flowering", day: 130 },
      { name: "Fruit development", day: 200 },
      { name: "Harvest window", day: 270 },
    ],
  },
  {
    name: "Coconut",
    variety: "West Coast Tall (demo variety)",
    days: 365,
    water: "High",
    soil: "Sandy loam, pH 5.5-8.0",
    season: "Perennial · year-round",
    pricePerQuintal: 3200,
    image: "https://images.unsplash.com/photo-1580984969071-a8da8e2eb8d0?w=600&auto=format&fit=crop",
    explanation: "Sample fit for coastal tropical conditions with high humidity.",
    stages: [
      { name: "Planting", day: 0 },
      { name: "Establishment", day: 60 },
      { name: "Vegetative growth", day: 150 },
      { name: "Inflorescence", day: 250 },
      { name: "Nut development", day: 320 },
      { name: "Harvest window", day: 365 },
    ],
  },
  {
    name: "Jute",
    variety: "JRO-524 (demo variety)",
    days: 120,
    water: "High",
    soil: "Alluvial loam, pH 6.0-7.5",
    season: "Kharif · Mar to Apr",
    pricePerQuintal: 4500,
    image: "https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?w=600&auto=format&fit=crop",
    explanation: "Sample fit for humid alluvial plains with high rainfall.",
    stages: [
      { name: "Field preparation", day: 0 },
      { name: "Germination", day: 8 },
      { name: "Vegetative growth", day: 30 },
      { name: "Rapid growth", day: 60 },
      { name: "Fibre maturity", day: 100 },
      { name: "Harvest window", day: 120 },
    ],
  },
  {
    name: "Coffee",
    variety: "Arabica (demo variety)",
    days: 270,
    water: "Medium",
    soil: "Well-drained loam, pH 6.0-6.5",
    season: "Perennial · flowers Feb to Mar",
    pricePerQuintal: 18000,
    image: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600&auto=format&fit=crop",
    explanation: "Sample fit for hilly tropical conditions with shade and moderate rainfall.",
    stages: [
      { name: "Flowering", day: 0 },
      { name: "Fruit set", day: 30 },
      { name: "Green berry", day: 90 },
      { name: "Berry development", day: 160 },
      { name: "Ripening", day: 230 },
      { name: "Harvest window", day: 270 },
    ],
  },
];

export const activities: Activity[] = [
  { id: "prepare", title: "Prepare the field", stage: "Land preparation", day: -5, description: "Check drainage and prepare a level seedbed for the selected crop." },
  { id: "sow", title: "Sow selected crop", stage: "Sowing", day: 0, description: "Use seed and spacing guidance verified with your local agriculture officer." },
  { id: "emergence", title: "Check crop establishment", stage: "Germination", day: 9, description: "Inspect emergence across the field and note any uneven patches." },
  { id: "water", title: "Review soil moisture", stage: "Irrigation check", day: 18, description: "Check soil moisture before deciding whether irrigation is needed." },
  { id: "weed", title: "Inspect for weeds", stage: "Early growth", day: 25, description: "Walk the field and record weed pressure for local advice." },
  { id: "nutrient", title: "Review nutrient plan", stage: "Nutrient management", day: 35, description: "Use soil-test results and locally verified guidance to plan nutrients." },
  { id: "scout", title: "Scout for pests and disease", stage: "Crop monitoring", day: 46, description: "Identify any pest or disease, assess threshold, and seek local advice. Follow product labels if treatment is needed." },
  { id: "flower", title: "Monitor flowering", stage: "Flowering", day: 60, description: "Record flowering progress and check for moisture stress." },
  { id: "weather", title: "Review rainfall conditions", stage: "Crop monitoring", day: 76, description: "Sample weather reminder only. Check a trusted local forecast before field decisions." },
  { id: "readiness", title: "Check harvest readiness", stage: "Harvest readiness", day: 90, description: "Compare crop maturity with local harvest guidance before planning labor." },
  { id: "harvest", title: "Plan harvest window", stage: "Harvest", day: 105, description: "Confirm maturity, drying space, and transport before harvest." },
];

// Storage records start empty. Providers can add their own local entries from the provider workspace.
export const facilities: Facility[] = [];

export const markets = [
  { name: "Guntur market (sample)", priceFactor: 1.02, change: "+1.8%" },
  { name: "Tenali market (sample)", priceFactor: 0.98, change: "-0.6%" },
  { name: "Vijayawada market (sample)", priceFactor: 1.05, change: "+0.9%" },
];

export const priceHistoryFactors = [0.91, 0.93, 0.92, 0.95, 0.94, 0.97, 0.96, 1.02, 0.99, 1.04, 1.02, 1];

function currentIntlLocale(): string {
  const language = document.documentElement.lang;
  return language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-IN";
}

export function formatRupees(value: number): string {
  return new Intl.NumberFormat(currentIntlLocale(), {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatStorageRate(value: number): string {
  return new Intl.NumberFormat(currentIntlLocale(), {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function addDays(date: string, days: number): string {
  if (!isIsoDate(date) || !Number.isFinite(days)) return "";
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + Math.trunc(days)));
  if (value.getUTCFullYear() < 1000 || value.getUTCFullYear() > 9999) return "";
  return [
    value.getUTCFullYear().toString().padStart(4, "0"),
    (value.getUTCMonth() + 1).toString().padStart(2, "0"),
    value.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function localDateString(date = new Date()): string {
  return [
    date.getFullYear().toString().padStart(4, "0"),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
  ].join("-");
}

export function daysBetween(from: string, to: string): number {
  if (!isIsoDate(from) || !isIsoDate(to)) return 0;
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  const start = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const end = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((end - start) / 86400000);
}

export function quantityInQuintals(quantity: number, unit: string): number {
  const factors: Record<string, number> = {
    quintals: 1,
    tonnes: 10,
    kilograms: 0.01,
  };
  const factor = factors[unit] ?? 1;
  return Number.isFinite(quantity) ? Math.max(0, quantity) * factor : 0;
}

export function calculateRevenue(
  quantity: number,
  unit: string,
  pricePerQuintal: number,
  costs: number[],
  storageLossPercent = 0,
): RevenueSummary {
  const saleableQuintals = quantityInQuintals(quantity, unit) * (1 - Math.min(100, Math.max(0, storageLossPercent)) / 100);
  const grossRevenue = saleableQuintals * Math.max(0, Number.isFinite(pricePerQuintal) ? pricePerQuintal : 0);
  const totalCosts = costs.reduce((sum, cost) => sum + Math.max(0, Number.isFinite(cost) ? cost : 0), 0);
  return {
    saleableQuintals,
    grossRevenue,
    totalCosts,
    netReturn: grossRevenue - totalCosts,
  };
}

export function samplePriceHistory(referencePrice: number): number[] {
  return priceHistoryFactors.map((factor) => Math.round(referencePrice * factor));
}

export function cropActivities(crop: CropInfo): Activity[] {
  const scale = crop.days / 105;
  return activities.map((activity) => {
    if (activity.id === "harvest") return { ...activity, day: crop.days - 5, duration: 5 };
    if (activity.id === "prepare") return { ...activity, day: -5 };
    return { ...activity, day: Math.round(activity.day * scale) };
  });
}
