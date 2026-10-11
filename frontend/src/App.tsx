import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarBlank,
  CaretDown,
  Check,
  CheckCircle,
  CaretLeft,
  CaretRight,
  Circle,
  ClipboardText,
  CloudSun,
  Compass,
  Database,
  DownloadSimple,
  Drop,
  Farm,
  Flower,
  GlobeHemisphereWest,
  House,
  Leaf,
  ListChecks,
  MapPin,
  List,
  Moon,
  Package,
  Plant,
  Plus,
  Rows,
  Sun,
  TestTube,
  TrendUp,
  Warehouse,
  Warning,
  X,
} from "@phosphor-icons/react";
import {
  addDays,
  calculateRevenue,
  cropActivities,
  crops,
  daysBetween,
  facilities,
  formatRupees,
  formatStorageRate,
  localDateString,
  markets,
  quantityInQuintals,
  samplePriceHistory,
  type Activity,
  type CropInfo,
  type CropKey,
  type Facility,
  type View,
} from "./data";
import StorageProviderPage from "./StorageProvider";
import { getIntlLocale, getLanguage, languageNames, translate, useLocalization, type Language } from "./i18n";

const navigation: { label: View; icon: typeof House }[] = [
  { label: "Overview", icon: House },
  { label: "Soil & crop recommendations", icon: TestTube },
  { label: "Crop calendar", icon: CalendarBlank },
  { label: "Harvest & market prices", icon: TrendUp },
  { label: "Storage locations", icon: Warehouse },
  { label: "My farm", icon: Farm },
  { label: "Settings", icon: ClipboardText },
];

const storageModelCrops = [
  "Apple",
  "Banana",
  "Cabbage",
  "Cauliflower",
  "Chilli",
  "Garlic",
  "Okra",
  "Onion",
  "Potato",
  "Tomato",
];

function activityKey(cropName: CropKey, id: string): string {
  return `${cropName}:${id}`;
}

type SoilForm = {
  coordinates: string;
  nitrogen: string;
  phosphorus: string;
  potassium: string;
  ph: string;
  soil: string;
  water: string;
  area: string;
  areaUnit: string;
  irrigation: string;
  temperature: string;
  humidity: string;
  rainfall: string;
};

type CropPrediction = {
  crop: string;
  class_probability: number;
};

type CropPredictionResponse = {
  recommendations: CropPrediction[];
  probability_note: string;
};

type StoragePredictionResponse = {
  crop: string;
  decision: "Store" | "Sell";
  class_probability: number;
  market: {
    state: string;
    district: string;
    name: string;
    arrival_date: string;
    modal_price_per_quintal: number;
    min_price_per_quintal: number;
    max_price_per_quintal: number;
  };
  data_mode: "online" | "offline";
  data_source: string;
  offline_reason: string | null;
  historical_training_range: { start: string; end: string };
  target_definition: string;
  model_evaluation: { training_rows: number; test_rows: number; accuracy: number } | null;
  advisory_note: string;
};

type DatasetSummary = {
  source_file: string;
  source_provenance: string;
  original_rows: number;
  cleaned_rows: number;
  invalid_rows_excluded: number;
  duplicate_rows_excluded: number;
  feature_count: number;
  crop_categories: string[];
  missing_values_after_cleaning: Record<string, number>;
  processed_at_utc: string;
  date_range: string | null;
};

type CropModelMetrics = {
  accuracy: number;
  precision_macro: number;
  recall_macro: number;
  f1_macro: number;
  test_rows: number;
  class_count: number;
  evaluation: string;
};

type DemoState = {
  view: View;
  selectedCrop: CropKey | null;
  sowingDate: string;
  completed: string[];
  quantity: number;
  unit: string;
  harvestDate: string;
  grade: string;
  sellCost: number;
  transportCost: number;
  futurePrice: number;
  storageLoss: number;
  storageCost: number;
  soilForm: SoilForm;
  analyzed: boolean;
  analysisError: string;
  notificationRead: boolean;
  selectedMarket: number;
  facilities: Facility[];
  selectedFacility: string | null;
  reserved: boolean;
  dark: boolean;
};

const defaultForm: SoilForm = {
  coordinates: "",
  nitrogen: "",
  phosphorus: "",
  potassium: "",
  ph: "",
  soil: "",
  water: "",
  area: "",
  areaUnit: "acres",
  irrigation: "",
  temperature: "",
  humidity: "",
  rainfall: "",
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const OWM_API_KEY = import.meta.env.VITE_OWM_API_KEY as string | undefined;

type WeatherData = {
  temperature: number;
  humidity: number;
  rainfall: number;
  description: string;
  latitude: number;
  longitude: number;
};

async function fetchCurrentWeather(lat: number, lon: number): Promise<WeatherData> {
  if (!OWM_API_KEY) throw new Error("OpenWeatherMap API key is not configured.");
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Weather fetch failed (${response.status}).`);
  const data = await response.json() as {
    main: { temp: number; humidity: number };
    rain?: { "1h"?: number; "3h"?: number };
    weather: { description: string }[];
  };
  return {
    temperature: Math.round(data.main.temp * 10) / 10,
    humidity: data.main.humidity,
    rainfall: Math.round(((data.rain?.["1h"] ?? data.rain?.["3h"] ?? 0) * 24) * 10) / 10,
    description: data.weather[0]?.description ?? "",
    latitude: lat,
    longitude: lon,
  };
}
const cropDisplayNames: Record<string, string> = {
  blackgram: "Black gram",
  kidneybeans: "Kidney beans",
  mothbeans: "Moth beans",
  mungbean: "Mung bean",
  pigeonpeas: "Pigeon peas",
  greengram: "Green gram",
  watermelon: "Watermelon",
  muskmelon: "Muskmelon",
  pomegranate: "Pomegranate",
  chickpea: "Chickpea",
  lentil: "Lentil",
  banana: "Banana",
  mango: "Mango",
  grapes: "Grapes",
  apple: "Apple",
  orange: "Orange",
  papaya: "Papaya",
  coconut: "Coconut",
  jute: "Jute",
  coffee: "Coffee",
  rice: "Rice",
  maize: "Maize",
  groundnut: "Groundnut",
  cotton: "Cotton",
};

function cropDisplayName(crop: string): string {
  return cropDisplayNames[crop.toLowerCase()] ?? crop.charAt(0).toUpperCase() + crop.slice(1);
}

// Match model prediction name (e.g. "kidneybeans") to CropInfo in data.ts
function findCropByPrediction(predictionName: string) {
  const normalized = predictionName.toLowerCase().replace(/[^a-z]/g, "");
  return crops.find((c) => c.name.toLowerCase().replace(/[^a-z]/g, "") === normalized);
}

function isCropPredictionResponse(value: unknown): value is CropPredictionResponse {
  if (!value || typeof value !== "object" || !("recommendations" in value) || !Array.isArray(value.recommendations)) {
    return false;
  }
  return value.recommendations.every((item: unknown) =>
    item !== null &&
    item !== undefined &&
    typeof item === "object" &&
    "crop" in item &&
    typeof item.crop === "string" &&
    "class_probability" in item &&
    typeof item.class_probability === "number" &&
    Number.isFinite(item.class_probability),
  ) && "probability_note" in value && typeof value.probability_note === "string";
}

function apiErrorDetail(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("detail" in value)) return null;
  const detail = value.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item: unknown) =>
      item && typeof item === "object" && "msg" in item && typeof item.msg === "string" ? item.msg : "",
    ).filter(Boolean).join(" ");
  }
  return null;
}

const initialState: DemoState = {
  view: "Overview",
  selectedCrop: null,
  sowingDate: localDateString(),
  completed: [],
  quantity: 18,
  unit: "quintals",
  harvestDate: localDateString(),
  grade: "Standard",
  sellCost: 650,
  transportCost: 420,
  futurePrice: 2450,
  storageLoss: 2,
  storageCost: 780,
  soilForm: defaultForm,
  analyzed: false,
  analysisError: "",
  notificationRead: false,
  selectedMarket: 0,
  facilities,
  selectedFacility: null,
  reserved: false,
  dark: false,
};

function restoreFacilities(value: unknown): Facility[] {
  if (!Array.isArray(value)) return facilities;

  const restored = value.flatMap((candidate): Facility[] => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const savedFacility = candidate as Partial<Facility>;
    if (typeof savedFacility.id !== "string") return [];

    const sampleFacility = facilities.find((facility) => facility.id === savedFacility.id);
    if (sampleFacility) {
      return [{
        ...sampleFacility,
        ...savedFacility,
        crops: Array.isArray(savedFacility.crops) ? savedFacility.crops : [...sampleFacility.crops],
        devices: Array.isArray(savedFacility.devices)
          ? savedFacility.devices
          : sampleFacility.devices.map((device) => ({ ...device })),
      }];
    }

    if (savedFacility.providerManaged === true &&
      Array.isArray(savedFacility.crops) &&
      Array.isArray(savedFacility.devices) &&
      typeof savedFacility.capacityUnit === "string") {
      return [savedFacility as Facility];
    }
    return [];
  });

  if (restored.length !== value.length) {
    console.warn("Some invalid saved storage facility records were discarded.");
  }
  return restored;
}

function loadDemoState(): DemoState {
  try {
    const saved = localStorage.getItem("farmshield-demo");
    if (!saved) return initialState;
    const restored = { ...initialState, ...JSON.parse(saved) } as DemoState;
    restored.facilities = restoreFacilities(restored.facilities);
    restored.soilForm = { ...defaultForm, ...(restored.soilForm ?? {}), coordinates: "" };
    if (!crops.some((item) => item.name === restored.selectedCrop)) restored.selectedCrop = null;
    restored.completed = Array.isArray(restored.completed)
      ? restored.selectedCrop
        ? restored.completed.map((id) => id.includes(":") ? id : activityKey(restored.selectedCrop!, id))
        : restored.completed
      : [];
    if (!Number.isFinite(restored.quantity) || restored.quantity < 0) restored.quantity = initialState.quantity;
    if (!["quintals", "tonnes", "kilograms"].includes(restored.unit)) restored.unit = initialState.unit;
    const validViews: View[] = navigation.map(({ label }) => label);
    if (!validViews.includes(restored.view)) restored.view = initialState.view;
    if (!Number.isInteger(restored.selectedMarket) || restored.selectedMarket < 0 || restored.selectedMarket >= markets.length) {
      restored.selectedMarket = initialState.selectedMarket;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(restored.sowingDate)) restored.sowingDate = localDateString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(restored.harvestDate)) restored.harvestDate = localDateString();
    return restored;
  } catch (error) {
    console.error("Could not restore FarmShield demo state.", error);
    return initialState;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStoragePredictionResponse(value: unknown): value is StoragePredictionResponse {
  return isRecord(value) &&
    typeof value.crop === "string" &&
    (value.decision === "Store" || value.decision === "Sell") &&
    typeof value.class_probability === "number" &&
    isRecord(value.market) &&
    typeof value.market.state === "string" &&
    typeof value.market.district === "string" &&
    typeof value.market.name === "string" &&
    typeof value.market.arrival_date === "string" &&
    typeof value.market.modal_price_per_quintal === "number" &&
    typeof value.market.min_price_per_quintal === "number" &&
    typeof value.market.max_price_per_quintal === "number" &&
    (value.data_mode === "online" || value.data_mode === "offline") &&
    typeof value.data_source === "string" &&
    (typeof value.offline_reason === "string" || value.offline_reason === null) &&
    isRecord(value.historical_training_range) &&
    typeof value.historical_training_range.start === "string" &&
    typeof value.historical_training_range.end === "string" &&
    typeof value.target_definition === "string" &&
    (value.model_evaluation === null ||
      (isRecord(value.model_evaluation) &&
        typeof value.model_evaluation.training_rows === "number" &&
        typeof value.model_evaluation.test_rows === "number" &&
        typeof value.model_evaluation.accuracy === "number")) &&
    typeof value.advisory_note === "string";
}

function isDatasetSummary(value: unknown): value is DatasetSummary {
  return isRecord(value) &&
    typeof value.source_file === "string" &&
    typeof value.source_provenance === "string" &&
    typeof value.original_rows === "number" &&
    typeof value.cleaned_rows === "number" &&
    typeof value.invalid_rows_excluded === "number" &&
    typeof value.duplicate_rows_excluded === "number" &&
    typeof value.feature_count === "number" &&
    Array.isArray(value.crop_categories) &&
    value.crop_categories.every((crop) => typeof crop === "string") &&
    isRecord(value.missing_values_after_cleaning) &&
    typeof value.processed_at_utc === "string" &&
    (typeof value.date_range === "string" || value.date_range === null);
}

function isModelMetrics(value: unknown): value is { crop_recommendation: CropModelMetrics } {
  if (!isRecord(value) || !isRecord(value.crop_recommendation)) return false;
  const model = value.crop_recommendation;
  return typeof model.accuracy === "number" &&
    typeof model.precision_macro === "number" &&
    typeof model.recall_macro === "number" &&
    typeof model.f1_macro === "number" &&
    typeof model.test_rows === "number" &&
    typeof model.class_count === "number" &&
    typeof model.evaluation === "string";
}

async function requestApi<T>(
  path: string,
  validate: (value: unknown) => value is T,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { signal });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The API returned an unreadable response.");
  }
  if (!response.ok) {
    throw new Error(apiErrorDetail(payload) || `Request failed with status ${response.status}.`);
  }
  if (!validate(payload)) throw new Error("The API returned data in an unexpected format.");
  return payload;
}

function dateLabel(date: string, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return "Not set";
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleDateString(getIntlLocale(), { ...options, timeZone: "UTC", ...(options ? {} : { day: "numeric", month: "short", year: "numeric" }) });
}

function LanguageSelect({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return (
    <label className="language-select">
      <GlobeHemisphereWest size={18} aria-hidden="true" />
      <span className="visually-hidden">Language</span>
      <select value={language} onChange={(event) => onChange(event.target.value as Language)} aria-label="Language">
        {(Object.keys(languageNames) as Language[]).map((code) => <option key={code} value={code}>{languageNames[code]}</option>)}
      </select>
    </label>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  let controlIndex = 0;
  function addControlId(element: React.ReactNode): React.ReactNode {
    if (!React.isValidElement(element)) return element;
    if (element.type === "input" || element.type === "select") {
      const index = controlIndex++;
      return React.cloneElement(element as React.ReactElement<React.HTMLAttributes<HTMLElement> & { id?: string }>, {
        id: index === 0 ? id : `${id}-${index}`,
        ...(index === 0 ? {
          "aria-invalid": error ? true : undefined,
          "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
        } : {}),
      });
    }
    if (typeof element.type === "string") {
      const props = element.props as { children?: React.ReactNode };
      return React.cloneElement(element as React.ReactElement<{ children?: React.ReactNode }>, {
        children: React.Children.map(props.children, addControlId),
      });
    }
    return element;
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {React.Children.map(children, addControlId)}
      {hint && <span id={hintId} className="field-hint">{hint}</span>}
      {error && <span id={errorId} className="field-error" role="alert">{error}</span>}
    </div>
  );
}

function SampleTag({ children = "Demo data" }: { children?: React.ReactNode }) {
  return <span className="sample-tag"><Database size={13} weight="bold" />{children}</span>;
}

function App() {
  const [language, setLanguage] = useState<Language>(getLanguage);
  const changeLanguage = (value: Language) => {
    setLanguage(value);
    try {
      localStorage.setItem("farmshield-language", value);
    } catch (error) {
      console.error("Could not save FarmShield language preference.", error);
    }
  };
  useLocalization(language);
  const [state, setState] = useState<DemoState>(() => {
    const restored = loadDemoState();
    const normalized = { ...restored };
    const numericFields: (keyof DemoState)[] = ["sellCost", "transportCost", "futurePrice", "storageLoss", "storageCost"];
    for (const field of numericFields) {
      const value = Number(normalized[field]);
      if (!Number.isFinite(value) || value < 0) {
        if (field === "sellCost") normalized.sellCost = initialState.sellCost;
        if (field === "transportCost") normalized.transportCost = initialState.transportCost;
        if (field === "futurePrice") normalized.futurePrice = initialState.futurePrice;
        if (field === "storageLoss") normalized.storageLoss = initialState.storageLoss;
        if (field === "storageCost") normalized.storageCost = initialState.storageCost;
      }
    }
    return normalized;
  });
  const [dashboardMode, setDashboardMode] = useState<"selection" | "farmer" | "provider">("selection");
  useEffect(() => {
    const title = dashboardMode === "selection"
      ? "Choose a workspace"
      : dashboardMode === "provider"
        ? "Storage Provider Dashboard"
        : state.view;
    document.title = `FarmShield | ${translate(title, language)}`;
  }, [dashboardMode, language, state.view]);
  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      pageContentRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    };
    scrollToTop();
    const frame = window.requestAnimationFrame(scrollToTop);
    return () => window.cancelAnimationFrame(frame);
  }, [dashboardMode, state.view]);
  const [toast, setToast] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [modelRecommendations, setModelRecommendations] = useState<CropPrediction[]>([]);
  const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(null);
  const [activityFilter, setActivityFilter] = useState("All activities");
  const [calendarMode, setCalendarMode] = useState<"Timeline" | "Calendar">("Timeline");
  const [facilityType, setFacilityType] = useState("All types");
  const [facilityMaxCost, setFacilityMaxCost] = useState(10);
  const [facilityCondition, setFacilityCondition] = useState("All conditions");
  const [facilityMonitoring, setFacilityMonitoring] = useState("Any monitoring");
  const [facilityLocation, setFacilityLocation] = useState("");
  const [menuFacility, setMenuFacility] = useState<Facility | null>(null);
  const modalRef = useRef<HTMLElement>(null);
  const pageContentRef = useRef<HTMLElement>(null);
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const mobileMenuRef = useRef<HTMLButtonElement>(null);
  const notificationsPopoverRef = useRef<HTMLDivElement>(null);
  const profilePopoverRef = useRef<HTMLDivElement>(null);
  const wasMobileNavOpen = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem("farmshield-demo", JSON.stringify({
        ...state,
        soilForm: { ...state.soilForm, coordinates: "" },
      }));
    } catch (error) {
      console.error("Could not save FarmShield demo state.", error);
    }
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (menuFacility) {
      modalRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    } else {
      modalTriggerRef.current?.focus();
    }
  }, [menuFacility]);

  useEffect(() => {
    if (mobileNavOpen) {
      document.querySelector<HTMLButtonElement>("#farm-navigation .nav-link")?.focus();
    } else if (wasMobileNavOpen.current) {
      mobileMenuRef.current?.focus();
    }
    wasMobileNavOpen.current = mobileNavOpen;
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!notificationsOpen && !profileOpen) return;
    const closeWhenOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (notificationsPopoverRef.current && !notificationsPopoverRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (profilePopoverRef.current && !profilePopoverRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, [notificationsOpen, profileOpen]);

  const crop = useMemo(
    () => crops.find((item) => item.name === state.selectedCrop) ?? null,
    [state.selectedCrop],
  );
  const activitiesForCrop = useMemo(() => crop ? cropActivities(crop) : [], [crop]);
  const today = localDateString();
  const rawDaysSinceSowing = daysBetween(state.sowingDate, today);
  const daysSinceSowing = Math.max(0, Math.min(crop?.days ?? 0, rawDaysSinceSowing));
  const remainingDays = Math.max(0, (crop?.days ?? 0) - daysSinceSowing);
  const currentStage = rawDaysSinceSowing < 0
    ? { name: "Sowing not started", day: 0 }
    : crop?.stages.reduce((selected, stage) => daysSinceSowing >= stage.day ? stage : selected, crop.stages[0]) ?? null;
  const currentPrice = crop?.pricePerQuintal ?? 2280;
  const selectedMarket = markets[state.selectedMarket] ?? markets[0];
  const basePrice = Math.round(currentPrice * selectedMarket.priceFactor);
  const sellEstimate = calculateRevenue(state.quantity, state.unit, basePrice, [state.sellCost, state.transportCost]);
  const storeEstimate = calculateRevenue(state.quantity, state.unit, state.futurePrice, [state.storageCost, state.transportCost], state.storageLoss);
  const sellGross = sellEstimate.grossRevenue;
  const sellNet = sellEstimate.netReturn;
  const saleableQuintals = storeEstimate.saleableQuintals;
  const saleableQuantity = state.quantity * (1 - state.storageLoss / 100);
  const storeNet = storeEstimate.netReturn;
  const storeDelta = storeNet - sellNet;
  const filteredFacilities = useMemo(
    () => state.facilities.filter((item) =>
      (!crop || item.crops.includes(crop.name)) &&
      (facilityType === "All types" || item.type === facilityType || (facilityType === "Warehouse" && item.type === "General Warehouse")) &&
      (item.pricingUnit === "per kilogram per day"
        ? item.dailyPrice * 1000
        : item.dailyPrice) <= facilityMaxCost &&
      (facilityCondition === "All conditions" || item.condition === facilityCondition) &&
      (facilityMonitoring === "Any monitoring" ||
        (facilityMonitoring === "Monitoring configured" ? item.devices.length > 0 : item.devices.length === 0)) &&
      (!facilityLocation.trim() || `${item.locality} ${item.sampleDistrict} ${item.state}`.toLowerCase().includes(facilityLocation.trim().toLowerCase())),
    ),
    [state.facilities, crop, facilityType, facilityMaxCost, facilityCondition, facilityMonitoring, facilityLocation],
  );

  const update = (values: Partial<DemoState>) => setState((previous) => ({ ...previous, ...values }));
  const updateForm = (key: keyof SoilForm, value: string) => {
    setModelRecommendations([]);
    setState((previous) => ({
      ...previous,
      analyzed: false,
      analysisError: "",
      soilForm: { ...previous.soilForm, [key]: value },
    }));
  };

  function navigate(view: View) {
    setDashboardMode("farmer");
    if (view === "Crop calendar" && !state.selectedCrop) {
      setToast("Choose a sample crop first to build its calendar.");
      update({ view: "Soil & crop recommendations" });
      return;
    }
    update({ view });
    setMobileNavOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  }

  function resetDemo() {
    if (!window.confirm("Reset demo data, including provider facilities and farmer settings?")) return;
    setState({ ...initialState, sowingDate: today, harvestDate: today });
    setDashboardMode("farmer");
    setMenuFacility(null);
    setToast("Demo data reset. You can start a new sample journey.");
    setProfileOpen(false);
  }

  async function analyzeSoil(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = state.soilForm;
    const area = Number(form.area);
    const ph = Number(form.ph);
    if (form.area && (!Number.isFinite(area) || area <= 0)) {
      update({ analysisError: "Farm area must be greater than zero." });
      return;
    }
    if (form.ph && (!Number.isFinite(ph) || ph < 0 || ph > 14)) {
      update({ analysisError: "Soil pH must be between 0 and 14." });
      return;
    }
    if (loadingAnalysis) return;
    setModelRecommendations([]);
    setCurrentWeather(null);
    update({ analysisError: "", analyzed: false });
    setLoadingAnalysis(true);

    // Fetch live weather from coordinates if available, then use those values for the model
    let resolvedForm = { ...form };
    const coordParts = form.coordinates.split(",").map((p) => p.trim());
    const coordLat = Number(coordParts[0]);
    const coordLon = Number(coordParts[1]);
    if (
      form.coordinates &&
      Number.isFinite(coordLat) && coordLat >= -90 && coordLat <= 90 &&
      Number.isFinite(coordLon) && coordLon >= -180 && coordLon <= 180
    ) {
      try {
        const weather = await fetchCurrentWeather(coordLat, coordLon);
        setCurrentWeather(weather);
        resolvedForm = {
          ...resolvedForm,
          temperature: String(weather.temperature),
          humidity: String(weather.humidity),
          rainfall: String(weather.rainfall),
        };
        setState((previous) => ({
          ...previous,
          soilForm: {
            ...previous.soilForm,
            temperature: String(weather.temperature),
            humidity: String(weather.humidity),
            rainfall: String(weather.rainfall),
          },
        }));
      } catch {
        // Weather fetch failed — continue with manually entered values
      }
    }

    const numericFields: { field: keyof SoilForm; label: string; min: number; max: number }[] = [
      { field: "nitrogen", label: "Nitrogen", min: 0, max: 500 },
      { field: "phosphorus", label: "Phosphorus", min: 0, max: 500 },
      { field: "potassium", label: "Potassium", min: 0, max: 500 },
      { field: "ph", label: "Soil pH", min: 0, max: 14 },
      { field: "temperature", label: "Average temperature", min: -20, max: 70 },
      { field: "humidity", label: "Relative humidity", min: 0, max: 100 },
      { field: "rainfall", label: "Typical rainfall", min: 0, max: 10000 },
    ];
    for (const entry of numericFields) {
      const rawValue = resolvedForm[entry.field];
      if (!rawValue.trim()) {
        update({ analysisError: `Enter ${entry.label.toLowerCase()} to run the crop model.` });
        setLoadingAnalysis(false);
        return;
      }
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value < entry.min || value > entry.max) {
        update({ analysisError: `${entry.label} must be between ${entry.min} and ${entry.max}.` });
        setLoadingAnalysis(false);
        return;
      }
    }
    try {
      const response = await fetch(`${API_BASE_URL}/predict/crop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          N: Number(resolvedForm.nitrogen),
          P: Number(resolvedForm.phosphorus),
          K: Number(resolvedForm.potassium),
          ph: Number(resolvedForm.ph),
          temperature: Number(resolvedForm.temperature),
          humidity: Number(resolvedForm.humidity),
          rainfall: Number(resolvedForm.rainfall),
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorDetail(payload) || `Prediction request failed with status ${response.status}.`);
      }
      if (!isCropPredictionResponse(payload) || payload.recommendations.length === 0) {
        throw new Error("The crop model returned an invalid or empty response.");
      }
      setModelRecommendations(payload.recommendations);
      update({ analysisError: "", analyzed: true });
      setToast("Crop model results are ready. Treat them as experimental, not as agronomic advice.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown prediction error.";
      update({ analysisError: `Crop model request failed: ${message}`, analyzed: false });
    } finally {
      setLoadingAnalysis(false);
    }
  }

  function selectCrop(selected: CropInfo) {
    update({
      selectedCrop: selected.name,
      view: "Crop calendar",
      sowingDate: today,
      futurePrice: Math.round(selected.pricePerQuintal * 1.08),
      selectedFacility: null,
      reserved: false,
    });
    setToast(`${selected.name} added to your demo crop calendar.`);
  }

  function requestLocation() {
    if (!OWM_API_KEY) {
      setToast("No weather API key configured — enter temperature, humidity, and rainfall manually.");
      return;
    }
    setToast("Fetching weather for your location…");
    fetch("https://ipapi.co/json/")
      .then((res) => {
        if (!res.ok) throw new Error(`IP geolocation failed (${res.status})`);
        return res.json();
      })
      .then((geo: { latitude: number; longitude: number; city: string; error?: boolean }) => {
        if (geo.error || !geo.latitude) throw new Error("IP geolocation failed");
        const lat = geo.latitude;
        const lon = geo.longitude;
        const city = geo.city ?? "your location";
        return fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric`)
          .then((res) => {
            if (!res.ok) throw new Error(`OWM ${res.status}`);
            return res.json();
          })
          .then((data: { main: { temp: number; humidity: number }; rain?: { "1h"?: number; "3h"?: number }; weather: { description: string }[] }) => {
            const temperature = Math.round(data.main.temp * 10) / 10;
            const humidity = data.main.humidity;
            const rainfall = Math.round(((data.rain?.["1h"] ?? data.rain?.["3h"] ?? 0) * 24) * 10) / 10;
            const description = data.weather[0]?.description ?? "";
            const coordString = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
            setCurrentWeather({ temperature, humidity, rainfall, description, latitude: lat, longitude: lon });
            setModelRecommendations([]);
            setState((previous) => ({
              ...previous,
              analyzed: false,
              analysisError: "",
              soilForm: {
                ...previous.soilForm,
                coordinates: coordString,
                temperature: String(temperature),
                humidity: String(humidity),
                rainfall: String(rainfall),
              },
            }));
            setToast(`Live weather for ${city}: ${temperature}°C, ${humidity}% humidity, ${rainfall} mm rainfall. Fields auto-filled.`);
          });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("requestLocation error:", err);
        setToast(`Weather fetch failed: ${msg}`);
      });
  }

  function toggleComplete(key: string) {
    const exists = state.completed.includes(key);
    if (!exists && crop) {
      // Find the activity being marked
      const [, taskId] = key.split(":");
      const task = activitiesForCrop.find((a) => a.id === taskId);
      if (task) {
        const hasIncompleteBefore = activitiesForCrop.some(
          (a) => a.day < task.day && !state.completed.includes(activityKey(crop.name, a.id)),
        );
        if (hasIncompleteBefore) {
          setToast("Complete earlier activities first.");
          return;
        }
      }
    }
    update({ completed: exists ? state.completed.filter((item) => item !== key) : [...state.completed, key] });
    setToast(exists ? "Activity marked as upcoming." : "Activity marked complete.");
  }

  function confirmSell() {
    setToast("Demo only. No sale or transaction has been made.");
  }

  function openStorage() {
    update({ view: "Storage locations" });
    setToast("Showing example facilities. Availability and fees are not verified.");
  }

  function confirmReservation() {
    if (!menuFacility) return;
    update({ selectedFacility: menuFacility.id, reserved: true });
    setToast("Demo confirmation only. No facility was contacted or reserved.");
  }

  function openFacilityDetails(facility: Facility) {
    modalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMenuFacility(facility);
  }

  function saveFacility(facility: Facility) {
    setState((previous) => ({
      ...previous,
      facilities: previous.facilities.some((item) => item.id === facility.id)
        ? previous.facilities.map((item) => item.id === facility.id ? facility : item)
        : [...previous.facilities, facility],
    }));
  }

  function removeFacility(facility: Facility) {
    setState((previous) => ({
      ...previous,
      facilities: previous.facilities.filter((item) => item.id !== facility.id),
      selectedFacility: previous.selectedFacility === facility.id ? null : previous.selectedFacility,
      reserved: previous.selectedFacility === facility.id ? false : previous.reserved,
    }));
    if (menuFacility?.id === facility.id) setMenuFacility(null);
  }

  function toggleFacilityAvailability(facility: Facility) {
    const availability = facility.availability === "Unavailable" ? "Available" : "Unavailable";
    saveFacility({
      ...facility,
      availability,
      updatedAt: new Date().toLocaleString("en-IN"),
    });
    setToast(`${facility.name} marked ${availability.toLowerCase()}. Farmer listings update immediately.`);
  }

  function previewFacility(facility: Facility) {
    setDashboardMode("farmer");
    update({ view: "Storage locations", reserved: false, selectedFacility: null });
    setMobileNavOpen(false);
    openFacilityDetails(facility);
  }

  function selectWorkspace(mode: "farmer" | "provider") {
    setDashboardMode(mode);
    setMenuFacility(null);
    setMobileNavOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  }

  function showRoleSelection() {
    setDashboardMode("selection");
    setMenuFacility(null);
    setMobileNavOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  }

  const renderContent = () => {
    switch (state.view) {
      case "Soil & crop recommendations":
        return (
          <SoilPage
            form={state.soilForm}
            analyzed={state.analyzed}
            loading={loadingAnalysis}
            error={state.analysisError}
            options={modelRecommendations}
            currentWeather={currentWeather}
            onField={updateForm}
            onAnalyze={analyzeSoil}
            onClear={() => {
              setModelRecommendations([]);
              update({ soilForm: defaultForm, analyzed: false, analysisError: "" });
              setToast("Soil form cleared.");
            }}
            onSample={() => {
              setModelRecommendations([]);
              update({
                soilForm: {
                  ...defaultForm,
                  nitrogen: "90",
                  phosphorus: "42",
                  potassium: "43",
                  ph: "6.5",
                  soil: "Loam",
                  water: "Moderate",
                  area: "3.5",
                  irrigation: "Available",
                  temperature: "20.9",
                  humidity: "82",
                  rainfall: "203",
                },
                analyzed: false,
                analysisError: "",
              });
              setToast("Sample soil values loaded. Edit them before analysis.");
            }}
            onLocation={requestLocation}
            onSelect={selectCrop}
            onRemove={() => update({ selectedCrop: null, view: "Soil & crop recommendations" })}
            selectedCrop={state.selectedCrop}
          />
        );
      case "Crop calendar":
        return crop ? (
          <CalendarPage
            crop={crop}
            activities={activitiesForCrop}
            initialCoordinates={state.soilForm.coordinates}
            weatherData={currentWeather}
            soilForm={state.soilForm}
            sowingDate={state.sowingDate}
            daysSince={daysSinceSowing}
            daysToSowing={Math.max(0, -rawDaysSinceSowing)}
            remainingDays={remainingDays}
            currentStage={currentStage?.name ?? "Land preparation"}
            completed={state.completed}
            filter={activityFilter}
            mode={calendarMode}
            onSowing={(value) => update({ sowingDate: value })}
            onFilter={setActivityFilter}
            onMode={setCalendarMode}
            onComplete={toggleComplete}
            onGoMarket={() => navigate("Harvest & market prices")}
          />
        ) : <EmptyPanel title="Choose a crop to start" description="Sample calendars adjust to the crop and the sowing date you enter." action="View recommendations" onAction={() => navigate("Soil & crop recommendations")} />;
      case "Harvest & market prices":
        return (
          <MarketPage
            crop={crop}
            quantity={state.quantity}
            unit={state.unit}
            harvestDate={state.harvestDate}
            grade={state.grade}
            sellCost={state.sellCost}
            transportCost={state.transportCost}
            futurePrice={state.futurePrice}
            storageLoss={state.storageLoss}
            storageCost={state.storageCost}
            selectedMarket={state.selectedMarket}
            basePrice={basePrice}
            sellGross={sellGross}
            sellNet={sellNet}
            saleableQuantity={saleableQuantity}
            saleableQuintals={saleableQuintals}
            sellQuintals={quantityInQuintals(state.quantity, state.unit)}
            storeNet={storeNet}
            storeDelta={storeDelta}
            onUpdate={(values) => {
              if (values.selectedCrop && values.selectedCrop !== state.selectedCrop) {
                const selected = crops.find((item) => item.name === values.selectedCrop);
                update({ ...values, futurePrice: Math.round((selected?.pricePerQuintal ?? 2280) * 1.08) });
              } else {
                update(values);
              }
            }}
            onMarket={(index) => update({ selectedMarket: index })}
            onSell={confirmSell}
            onStore={openStorage}
          />
        );
      case "Storage locations":
        return (
          <StoragePage
            crop={crop}
            facilities={filteredFacilities}
            type={facilityType}
            maxCost={facilityMaxCost}
            locationFilter={facilityLocation}
            condition={facilityCondition}
            monitoring={facilityMonitoring}
            selectedFacility={state.selectedFacility}
            reserved={state.reserved}
            onType={setFacilityType}
            onCost={setFacilityMaxCost}
            onLocationFilter={setFacilityLocation}
            onCondition={setFacilityCondition}
            onMonitoring={setFacilityMonitoring}
            onProviderPortal={() => setDashboardMode("provider")}
            onDetails={openFacilityDetails}
            onSelect={(facility) => {
              openFacilityDetails(facility);
              update({ reserved: false });
            }}
          />
        );
      case "My farm":
        return <FarmPage crop={crop} area={state.soilForm.area} unit={state.soilForm.areaUnit} form={state.soilForm} language={language} onNavigate={navigate} />;
      case "Settings":
        return (
          <SettingsPage
            language={language}
            dark={state.dark}
            onLanguage={changeLanguage}
            onDark={(value) => update({ dark: value })}
            onReset={resetDemo}
          />
        );
      default:
        return (
          <OverviewPage
            crop={crop}
            area={state.soilForm.area}
            areaUnit={state.soilForm.areaUnit}
            stage={currentStage?.name ?? "Planning"}
            remainingDays={remainingDays}
            sowingDate={state.sowingDate}
            cropActivities={activitiesForCrop}
            completed={state.completed}
            facilities={state.facilities}
            onNavigate={navigate}
            onComplete={toggleComplete}
            onDetails={openFacilityDetails}
          />
        );
    }
  };

  if (dashboardMode === "selection") {
    return <RoleSelection onSelect={selectWorkspace} language={language} onLanguage={changeLanguage} />;
  }

  return (
    <div className={`app-shell${state.dark ? " theme-dark" : ""}`}>
      <aside
        className={`sidebar${sidebarCollapsed ? " collapsed" : ""}${mobileNavOpen ? " mobile-open" : ""}`}
        onKeyDown={(event) => {
          if (!mobileNavOpen) return;
          if (event.key === "Escape") {
            setMobileNavOpen(false);
            return;
          }
          if (event.key !== "Tab") return;
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"));
          if (!focusable.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="brand-row">
          <div className="brand-mark"><Leaf size={21} weight="fill" /></div>
          {!sidebarCollapsed && <div className="brand-name">Farm<span>Shield</span></div>}
          <button className="icon-button mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        {!sidebarCollapsed && <div className="workspace-label">{dashboardMode === "farmer" ? "FARM WORKSPACE" : "STORAGE WORKSPACE"}</div>}
        <nav id="farm-navigation" aria-label="Main navigation" className="side-nav">
          {dashboardMode === "farmer" ? navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-link${state.view === label ? " active" : ""}`}
              onClick={() => navigate(label)}
              title={sidebarCollapsed ? label : undefined}
              aria-current={state.view === label ? "page" : undefined}
            >
              <Icon size={19} weight={state.view === label ? "fill" : "regular"} />
              {!sidebarCollapsed && <span>{label}</span>}
              {label === "Crop calendar" && state.selectedCrop && !sidebarCollapsed && <span className="nav-count">1</span>}
            </button>
          )) : (
            <div className="nav-link active" aria-current="page" title={sidebarCollapsed ? "Facilities" : undefined}>
              <Warehouse size={19} weight="fill" />
              {!sidebarCollapsed && <span>Facilities</span>}
            </div>
          )}
        </nav>
        {!sidebarCollapsed && (
          <div className="sidebar-bottom">
            {dashboardMode === "farmer" ? (
              <button className="profile-mini" onClick={() => navigate("My farm")}>
                <div className="avatar">RK</div>
                <span><strong>Ramesh Kumar</strong><small>Demo farmer</small></span>
                <CaretDown size={16} />
              </button>
            ) : (
              <div className="profile-mini provider-workspace-label">
                <div className="avatar"><Warehouse size={17} /></div>
                <span><strong>Storage provider</strong><small>Demo workspace</small></span>
              </div>
            )}
          </div>
        )}
        {sidebarCollapsed && dashboardMode === "farmer" && <button className="collapsed-avatar" onClick={() => navigate("My farm")} aria-label="Open farmer profile"><span className="avatar">RK</span></button>}
        {sidebarCollapsed && dashboardMode === "provider" && <div className="collapsed-avatar" aria-label="Storage provider workspace"><span className="avatar"><Warehouse size={17} /></span></div>}
      </aside>
      {mobileNavOpen && <button className="scrim" onClick={() => setMobileNavOpen(false)} aria-label="Close menu backdrop" />}
      <div className={`main-column${sidebarCollapsed ? " sidebar-is-collapsed" : ""}`}>
        <header className="topbar">
          <div className="topbar-left">
            <button ref={mobileMenuRef} className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" aria-expanded={mobileNavOpen} aria-controls="farm-navigation"><List size={21} /></button>
            <button className="collapse-toggle icon-button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {sidebarCollapsed ? <CaretRight size={18} /> : <CaretLeft size={18} />}
            </button>
            <div className="breadcrumb"><span>{dashboardMode === "farmer" ? "Farm workspace" : "Storage workspace"}</span><CaretRight size={14} /><strong>{dashboardMode === "farmer" ? state.view : "Facilities"}</strong></div>
          </div>
          <div className="topbar-actions">
            <LanguageSelect language={language} onChange={changeLanguage} />
            {dashboardMode === "farmer" && <div className="popover-anchor" ref={notificationsPopoverRef}>
              <button className="icon-button notification-button" onClick={() => { setNotificationsOpen((value) => !value); setProfileOpen(false); }} aria-label="Notifications" aria-expanded={notificationsOpen}>
                <Bell size={19} />{!state.notificationRead && <span className="notification-indicator" />}
              </button>
              {notificationsOpen && (
                <div className="popover notifications-popover">
                  <div className="popover-title"><strong>Notifications</strong><button onClick={() => update({ notificationRead: true })}>Mark read</button></div>
                  <div className="notice-row"><span className="notice-symbol"><CloudSun size={17} /></span><span><strong>Sample rainfall reminder</strong><small>Review a trusted forecast before irrigation decisions.</small><em>Demo notification</em></span></div>
                  <div className="notice-row"><span className="notice-symbol"><CalendarBlank size={17} /></span><span><strong>{crop ? "Crop plan ready" : "Start your crop plan"}</strong><small>{crop ? `${crop.name} calendar is available to review.` : "Add soil and location details to explore sample options."}</small></span></div>
                </div>
              )}
            </div>}
            {dashboardMode === "farmer" && <div className="popover-anchor" ref={profilePopoverRef}>
              <button className="top-avatar" onClick={() => { setProfileOpen((value) => !value); setNotificationsOpen(false); }} aria-label="Farmer profile menu" aria-expanded={profileOpen}>RK</button>
              {profileOpen && <div className="popover profile-popover"><div className="profile-popover-head"><span className="avatar">RK</span><span><strong>Ramesh Kumar</strong><small>Demo farmer</small></span></div><button onClick={() => navigate("My farm")}>My farm details</button><button onClick={() => navigate("Settings")}>Settings</button><button className="danger-link" onClick={resetDemo}>Reset demo data</button></div>}
            </div>}
          </div>
        </header>
        <main className="page-content" ref={pageContentRef}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">{dashboardMode === "provider" ? "STORAGE PROVIDER WORKSPACE" : state.view === "Overview" ? "YOUR FARM AT A GLANCE" : "FARMSHIELD WORKSPACE"}</p>
              <h1>{dashboardMode === "provider" ? "Storage Provider Dashboard" : state.view === "Overview" ? "Good morning, Ramesh" : state.view}</h1>
              <p className="heading-description">{dashboardMode === "provider" ? "Manage facility details and simulated monitoring in one shared demo." : state.view === "Overview" ? "A clear view of your farm plan, from soil to harvest." : pageDescription(state.view)}</p>
            </div>
            <div className="dashboard-heading-actions">
              <button className="button-quiet role-switch-button" onClick={showRoleSelection}>Switch role</button>
            </div>
          </div>
          {dashboardMode === "provider" ? (
            <StorageProviderPage
              facilities={state.facilities}
              onSave={saveFacility}
              onDelete={removeFacility}
              onToggleAvailability={toggleFacilityAvailability}
              onPreview={previewFacility}
              onReset={() => {
                setState({ ...initialState, sowingDate: today, harvestDate: today });
                setDashboardMode("farmer");
                setMenuFacility(null);
                setToast("Demo data reset. Sample facilities and farmer settings were restored.");
              }}
              onToast={setToast}
            />
          ) : renderContent()}
          <footer className="page-footer"><span>FarmShield is a decision-support demo.</span><span>Confirm farming decisions with verified local guidance.</span><button onClick={resetDemo}>Reset demo data</button></footer>
        </main>
      </div>
      {toast && <div className="toast" role="status"><CheckCircle size={18} weight="fill" />{toast}<button aria-label="Dismiss notification" onClick={() => setToast("")}><X size={16} /></button></div>}
      {dashboardMode === "farmer" && menuFacility && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuFacility(null); }}>
          <section
            ref={modalRef}
            className="facility-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="facility-title"
            aria-describedby="facility-description"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setMenuFacility(null);
                return;
              }
              if (event.key !== "Tab") return;
              const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"));
              if (!focusable.length) return;
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <div className="modal-heading"><div><span className="modal-icon"><Warehouse size={21} /></span><SampleTag>Provider entry</SampleTag></div><button className="icon-button" onClick={() => setMenuFacility(null)} aria-label="Close facility details"><X size={19} /></button></div>
            <h2 id="facility-title">{menuFacility.name}</h2>
            <p id="facility-description">{menuFacility.description}</p>
            <div className="detail-grid"><div><small>Location</small><strong>{menuFacility.address ? `${menuFacility.address}, ` : ""}{menuFacility.locality}, {menuFacility.sampleDistrict}, {menuFacility.state}, {menuFacility.country}</strong></div><div><small>Storage type</small><strong>{menuFacility.type}</strong></div><div><small>Condition / provider reported</small><strong>{menuFacility.condition}</strong></div><div><small>Availability</small><strong>{menuFacility.availability}</strong></div><div><small>Available capacity</small><strong>{Math.max(0, menuFacility.capacity - menuFacility.occupiedCapacity)} / {menuFacility.capacity} {menuFacility.capacityUnit}</strong></div><div><small>Daily price</small><strong>{formatStorageRate(menuFacility.dailyPrice)} / {menuFacility.pricingUnit}</strong></div><div><small>Minimum storage duration</small><strong>{translate(`${menuFacility.minimumDays} days`, language)}</strong></div><div><small>Handling and loading fees</small><strong>{formatRupees(menuFacility.handlingFee + menuFacility.loadingFee)}</strong></div><div><small>Cleanliness</small><strong>{menuFacility.cleanliness}</strong></div><div><small>Ventilation</small><strong>{menuFacility.ventilation}</strong></div><div><small>Moisture protection</small><strong>{menuFacility.moistureProtection}</strong></div><div><small>Pest-control status</small><strong>{menuFacility.pestControl}</strong></div><div><small>Last inspection date</small><strong>{menuFacility.inspectionDate ? dateLabel(menuFacility.inspectionDate) : "Not entered"}</strong></div><div><small>Maintenance notes</small><strong>{menuFacility.maintenanceNotes || "None entered"}</strong></div></div>
            <div className="facility-fit"><strong>Suitable crops</strong><div>{menuFacility.crops.map((item) => <span key={item}>{item}</span>)}</div></div>
            <div className="facility-fit"><strong>Environmental monitoring</strong><div>{menuFacility.devices.length ? menuFacility.devices.map((device) => <span key={device.id}>{device.name} ({device.type}): {device.status}, {device.enabled ? "enabled" : "disabled"}{device.temperature !== null ? `, ${device.temperature} °C` : ""}{device.humidity !== null ? `, ${device.humidity}% RH` : ""}. {device.updatedAt}</span>) : <span>No simulated devices configured</span>}</div><small>Simulated IoT Data - No Live Device Connected</small></div>
            {state.reserved && state.selectedFacility === menuFacility.id && <div className="inline-success"><CheckCircle size={18} />Demo confirmation saved. This is not a real reservation.</div>}
            <p className="fine-print">Details, charges, and availability are illustrative. Contact and verify a facility directly before making plans.</p>
            <div className="modal-actions"><button className="button-secondary" onClick={() => setMenuFacility(null)}>Close</button><button className="button-primary" onClick={confirmReservation} disabled={menuFacility.availability === "Unavailable" || menuFacility.capacity <= menuFacility.occupiedCapacity || (state.reserved && state.selectedFacility === menuFacility.id)}>{menuFacility.availability === "Unavailable" || menuFacility.capacity <= menuFacility.occupiedCapacity ? "Unavailable" : state.reserved && state.selectedFacility === menuFacility.id ? <><Check size={15} />Demo selection saved</> : <>Select facility <ArrowRight size={16} /></>}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

function pageDescription(view: View): string {
  const text: Record<View, string> = {
    Overview: "A clear view of your farm plan, from soil to harvest.",
    "Soil & crop recommendations": "Enter the model features to see ranked crop candidates from the supplied dataset.",
    "Crop calendar": "Plan crop activities around a selected crop and sowing date.",
    "Harvest & market prices": "Compare illustrative market prices and transparent selling scenarios.",
    "Storage locations": "Browse example facilities. Inventory and fees are not verified.",
    "My farm": "Review the farm information entered in this demo.",
    Settings: "Manage demo preferences and reset your sample journey.",
  };
  return text[view];
}

function NearbyStoragePanel({ facilities, onNavigate, onDetails }: { facilities: Facility[]; onNavigate: (view: View) => void; onDetails: (facility: Facility) => void }) {
  const top = useMemo(() => {
    return [...facilities]
      .filter((f) => f.availability !== "Unavailable" && f.capacity > f.occupiedCapacity)
      .sort((a, b) => {
        const priceA = a.pricingUnit === "per kilogram per day" ? a.dailyPrice * 1000 : a.dailyPrice;
        const priceB = b.pricingUnit === "per kilogram per day" ? b.dailyPrice * 1000 : b.dailyPrice;
        return priceA - priceB;
      })
      .slice(0, 3);
  }, [facilities]);

  return (
    <section className="panel nearby-storage-panel">
      <div className="section-title-row">
        <div><h3>Nearby &amp; low cost storage</h3><p>Available facilities sorted by daily rate</p></div>
        <button className="text-link" onClick={() => onNavigate("Storage locations")}>View all <ArrowRight size={14} /></button>
      </div>
      {top.length === 0 ? (
        <EmptyInline message="No available storage facilities yet. Providers can add listings from the Provider Portal." action="Browse storage" onAction={() => onNavigate("Storage locations")} />
      ) : (
        <div className="nearby-storage-list">
          {top.map((facility) => (
            <button key={facility.id} className="nearby-storage-item" onClick={() => { onNavigate("Storage locations"); onDetails(facility); }}>
              <span className="nearby-storage-icon"><Warehouse size={17} /></span>
              <span className="nearby-storage-info">
                <strong>{facility.name}</strong>
                <small>{facility.locality}, {facility.sampleDistrict}</small>
              </span>
              <span className="nearby-storage-price">
                <strong>{formatStorageRate(facility.dailyPrice)}</strong>
                <small>/{facility.pricingUnit.replace("per ", "").replace(" per day", "/day")}</small>
              </span>
              <ArrowRight size={14} className="nearby-storage-arrow" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function OverviewPage({
  crop,
  area,
  areaUnit,
  stage,
  remainingDays,
  sowingDate,
  cropActivities: taskList,
  completed,
  facilities,
  onNavigate,
  onComplete,
  onDetails,
}: {
  crop: CropInfo | null;
  area: string;
  areaUnit: string;
  stage: string;
  remainingDays: number;
  sowingDate: string;
  cropActivities: Activity[];
  completed: string[];
  facilities: Facility[];
  onNavigate: (view: View) => void;
  onComplete: (id: string) => void;
  onDetails: (facility: Facility) => void;
}) {
  const nextTask = taskList.find((item) => !completed.includes(activityKey(crop?.name ?? "Rice", item.id)));
  const progress = crop ? Math.min(100, Math.round((Math.max(0, crop.days - remainingDays) / crop.days) * 100)) : 0;
  const sampleHistory = samplePriceHistory(crop?.pricePerQuintal ?? 2280).slice(-8);
  const sampleReferencePrice = crop?.pricePerQuintal ?? 2280;
  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="hero-kicker"><Leaf size={15} weight="fill" /> FARM OVERVIEW <i /> SAMPLE FARM PROFILE</span>
          <h2>{crop ? `${crop.name} is on your farm plan.` : "A better season starts with a clear plan."}</h2>
          <p>{crop ? `${crop.variety} · ${stage} · ${remainingDays} estimated days to harvest.` : "Explore a sample crop recommendation, build a cultivation calendar, and compare harvest options."}</p>
          <button className="button-primary" onClick={() => onNavigate(crop ? "Crop calendar" : "Soil & crop recommendations")}>{crop ? "Open crop calendar" : "Start crop recommendations"}<ArrowRight size={17} /></button>
        </div>
        <div className="hero-photo" role="img" aria-label="Green crop field under a bright sky">
          <div className="photo-caption"><span>Farm planning</span><strong>Made practical, season by season.</strong></div>
        </div>
      </section>
      <div className="metric-grid">
        <Metric icon={<Farm size={20} />} label="Registered farm area" value={area ? `${area} ${areaUnit}` : "Not set"} detail={area ? "Entered demo information" : "Add your farm details"} />
        <Metric icon={<Plant size={20} />} label="Current growing crop" value={crop?.name ?? "Not selected"} detail={crop ? crop.variety : "Choose a sample crop"} />
        <Metric icon={<CalendarBlank size={20} />} label="Next farm activity" value={nextTask?.title ?? (crop ? "All tasks complete" : "Plan sowing")} detail={nextTask ? `Around ${dateLabel(addDays(sowingDate, nextTask.day))}` : "Start with a crop plan"} />
        <Metric icon={<Package size={20} />} label="Harvest readiness" value={crop ? `${progress}%` : "Not started"} detail={crop ? `${remainingDays} demo days remaining` : "Calendar appears after crop selection"} />
      </div>
      <div className="overview-grid">
        <section className="panel progress-panel">
          <div className="section-title-row"><div><h3>Growing season</h3><p>Sample progress based on your selected sowing date</p></div><SampleTag /></div>
          {crop ? <>
            <div className="season-top"><div><strong>{crop.name}</strong><span>{crop.variety}</span></div><span className="stage-pill"><span />{stage}</span></div>
            <div className="progress-track"><span style={{ width: `${Math.max(2, progress)}%` }} /></div>
            <div className="progress-meta"><span>{daysBetween(sowingDate, new Date().toISOString().slice(0, 10)) <= 0 ? "Sowing date" : `${Math.max(0, crop.days - remainingDays)} days elapsed`}</span><span>Estimated harvest in {remainingDays} days</span></div>
            <div className="season-dates"><div><small>Sowing date</small><strong>{dateLabel(sowingDate)}</strong></div><div><small>Illustrative harvest window</small><strong>{dateLabel(addDays(sowingDate, crop.days))}</strong></div></div>
          </> : <EmptyInline message="Select a sample crop to see your season progress." action="Explore crops" onAction={() => onNavigate("Soil & crop recommendations")} />}
        </section>
        <section className="panel activity-panel">
          <div className="section-title-row"><div><h3>Coming up</h3><p>Keep your next field task in view</p></div><button className="text-link" onClick={() => onNavigate(crop ? "Crop calendar" : "Soil & crop recommendations")}>View plan <ArrowRight size={14} /></button></div>
          {crop && nextTask ? <div className="next-task"><div className="task-date"><strong>{dateLabel(addDays(sowingDate, nextTask.day), { day: "numeric" })}</strong><span>{dateLabel(addDays(sowingDate, nextTask.day), { month: "short" })}</span></div><div className="next-task-copy"><strong>{nextTask.title}</strong><span>{nextTask.stage}</span><p>{nextTask.description}</p></div><button className="check-task" onClick={() => onComplete(activityKey(crop.name, nextTask.id))} aria-label="Mark next task complete"><Check size={17} /></button></div> : <EmptyInline message="Your upcoming tasks will appear after selecting a crop." action="Build a crop plan" onAction={() => onNavigate("Soil & crop recommendations")} />}
          <div className="weather-notice"><span className="weather-icon"><CloudSun size={20} /></span><span><strong>Sample rainfall reminder</strong><small>Check a trusted local forecast before irrigation decisions.</small></span><SampleTag>Demo</SampleTag></div>
        </section>
      </div>
      <div className="overview-bottom">
        <section className="panel workflow-panel">
          <div className="section-title-row"><div><h3>Your farming journey</h3><p>Keep each step connected from field to market</p></div></div>
          <div className="journey-steps">
            {[
              { icon: TestTube, title: "Soil & crop", text: "Explore crop options", view: "Soil & crop recommendations" as View, done: Boolean(crop) },
              { icon: CalendarBlank, title: "Cultivation", text: "Plan field activities", view: "Crop calendar" as View, done: completed.length > 0 },
              { icon: TrendUp, title: "Harvest & market", text: "Compare sample returns", view: "Harvest & market prices" as View, done: false },
              { icon: Warehouse, title: "Storage", text: "Browse sample facilities", view: "Storage locations" as View, done: Boolean(false) },
            ].map(({ icon: Icon, title, text, view, done }, index) => (
              <button className={`journey-step${done ? " complete" : ""}`} key={title} onClick={() => onNavigate(view)}>
                <span className="journey-index">{done ? <Check size={16} weight="bold" /> : <Icon size={18} />}</span><span className="journey-copy"><strong>{title}</strong><small>{text}</small></span>{index < 3 && <span className="journey-line" />}
              </button>
            ))}
          </div>
        </section>
        <section className="market-peek">
          <div className="section-title-row"><div><h3>Sample market snapshot</h3><p>Illustrative only, not live prices</p></div><TrendUp size={19} /></div>
          <div className="market-peek-value"><strong>{formatRupees(crop?.pricePerQuintal ?? 2280)}</strong><span>per quintal <b>Sample price</b></span></div>
          <div className="spark-bars" role="img" aria-label={`Illustrative sample price history per quintal: ${sampleHistory.map(formatRupees).join(", ")}`}>
            {sampleHistory.map((value, index) => <span key={`${value}-${index}`} style={{ height: `${22 + ((value - sampleReferencePrice * .8) / (sampleReferencePrice * .4)) * 33}px` }} />)}
          </div>
          <button className="text-link" onClick={() => onNavigate("Harvest & market prices")}>Compare markets <ArrowRight size={14} /></button>
        </section>
      </div>
      <NearbyStoragePanel facilities={facilities} onNavigate={onNavigate} onDetails={onDetails} />
    </>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <section className="metric-item"><div className="metric-icon">{icon}</div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></section>;
}

function EmptyInline({ message, action, onAction }: { message: string; action: string; onAction: () => void }) {
  return <div className="empty-inline"><span><Leaf size={18} /></span><p>{message}</p><button className="text-link" onClick={onAction}>{action} <ArrowRight size={14} /></button></div>;
}

function SoilPage({
  form,
  analyzed,
  loading,
  error,
  onField,
  onAnalyze,
  onClear,
  onSample,
  onLocation,
  options,
  currentWeather,
  onSelect,
  onRemove,
  selectedCrop,
}: {
  form: SoilForm;
  analyzed: boolean;
  loading: boolean;
  error: string;
  onField: (key: keyof SoilForm, value: string) => void;
  onAnalyze: (event: React.FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
  onSample: () => void;
  onLocation: () => void;
  options: CropPrediction[];
  currentWeather: WeatherData | null;
  onSelect: (crop: CropInfo) => void;
  onRemove: () => void;
  selectedCrop: CropKey | null;
}) {
  return (
    <div className="content-stack">
      <div className="callout demo-callout"><span><Warning size={19} /></span><p><strong>Experimental crop model.</strong> Model outputs are learned from the supplied crop dataset, whose publisher, license, and measurement units are not documented. Model probabilities are not guarantees of suitability; verify soil units and local agronomic advice before planting.</p></div>
      <section className="panel soil-panel">
        <div className="section-title-row"><div><h3>Soil & farm information</h3><p>Enter all seven model measurements. Confirm soil-test units locally.</p></div><div className="section-icon"><TestTube size={20} /></div></div>
        <form onSubmit={onAnalyze}>
          <section className="location-access-card" aria-label="Device location access">
            <div><Compass size={19} /><span><strong>Use your device location</strong><small>Optional. Fetches live weather (temperature, humidity, rainfall) from OpenWeatherMap to pre-fill the model inputs and pass to the crop calendar. Location is not saved.</small></span></div>
            <button type="button" className="button-secondary location-button" onClick={onLocation}><MapPin size={17} />{form.coordinates ? "Update device location" : "Allow location access"}</button>
          </section>
          {currentWeather && (
            <div className="weather-prefill-notice">
              <CloudSun size={16} />
              <span><strong>Live weather applied</strong> — {currentWeather.description}, {currentWeather.temperature}°C, {currentWeather.humidity}% humidity, {currentWeather.rainfall} mm rainfall. These values are pre-filled below and passed to the crop calendar.</span>
            </div>
          )}
          <div className="form-section-heading"><span>Soil measurements</span><small>Use values from a recent soil test where available</small></div>
          <div className="form-grid four">
            <Field label="Nitrogen (N) *" hint="Dataset units are undocumented"><input inputMode="decimal" value={form.nitrogen} onChange={(event) => onField("nitrogen", event.target.value)} placeholder="Required" /></Field>
            <Field label="Phosphorus (P) *" hint="Dataset units are undocumented"><input inputMode="decimal" value={form.phosphorus} onChange={(event) => onField("phosphorus", event.target.value)} placeholder="Required" /></Field>
            <Field label="Potassium (K) *" hint="Dataset units are undocumented"><input inputMode="decimal" value={form.potassium} onChange={(event) => onField("potassium", event.target.value)} placeholder="Required" /></Field>
            <Field label="Soil pH *" hint="Scale from 0 to 14"><input type="number" min="0" max="14" step="0.1" value={form.ph} onChange={(event) => onField("ph", event.target.value)} placeholder="Required" /></Field>
          </div>
          <div className="form-grid three soil-detail-grid">
            <Field label="Soil type"><select value={form.soil} onChange={(event) => onField("soil", event.target.value)}><option value="">Select if known</option><option>Loam</option><option>Clay loam</option><option>Sandy loam</option><option>Black soil</option><option>Red soil</option><option>Other</option></select></Field>
            <Field label="Soil moisture / water availability"><select value={form.water} onChange={(event) => onField("water", event.target.value)}><option value="">Select an estimate</option><option>Limited</option><option>Moderate</option><option>Reliable</option></select></Field>
            <Field label="Irrigation available"><select value={form.irrigation} onChange={(event) => onField("irrigation", event.target.value)}><option value="">Select an option</option><option>Available</option><option>Rain-fed</option><option>Seasonal</option></select></Field>
          </div>
          <div className="form-grid four">
            <Field label="Farm area"><div className="input-with-unit"><input type="number" min="0" step="0.1" value={form.area} onChange={(event) => onField("area", event.target.value)} placeholder="Optional" /><select aria-label="Farm area unit" value={form.areaUnit} onChange={(event) => onField("areaUnit", event.target.value)}><option>acres</option><option>hectares</option></select></div></Field>
            <Field label="Average temperature (°C) *"><input type="number" value={form.temperature} onChange={(event) => onField("temperature", event.target.value)} placeholder="Required" /></Field>
            <Field label="Relative humidity (%) *"><input type="number" min="0" max="100" value={form.humidity} onChange={(event) => onField("humidity", event.target.value)} placeholder="Required" /></Field>
            <Field label="Rainfall (mm) *"><input type="number" min="0" value={form.rainfall} onChange={(event) => onField("rainfall", event.target.value)} placeholder="Required" /></Field>
          </div>
          {error && <div className="form-error" role="alert"><Warning size={16} />{error}</div>}
          <div className="form-actions"><div><button className="button-primary" type="submit" disabled={loading}>{loading ? <><span className="button-loader" />Running crop model</> : <>Run crop model <ArrowRight size={16} /></>}</button><button type="button" className="button-quiet" onClick={onClear}>Clear form</button></div><button type="button" className="text-link" onClick={onSample}>Load sample data</button></div>
        </form>
      </section>
      {analyzed && options.length > 0 && (
        <section className="results-section">
          <div className="results-head"><div><p className="eyebrow">MODEL 1 OUTPUT</p><h2>Ranked crop candidates</h2><p>Model class probabilities are not calibrated confidence or verified suitability.</p></div><SampleTag>Trained model</SampleTag></div>
          {options.length ? <div className="recommendation-grid">{options.map((prediction) => {
            const item = findCropByPrediction(prediction.crop);
            return (
            <article className={`crop-card${item && selectedCrop === item.name ? " crop-selected" : ""}`} key={prediction.crop}>
              <div className="crop-photo">{item ? <img src={item.image} alt={`Sample field image used with the ${item.name} option`} loading="lazy" /> : <span className="crop-unknown-icon"><Plant size={28} /></span>}</div>
              <div className="crop-card-body">
                <div className="crop-card-top"><div><h3>{cropDisplayName(prediction.crop)}</h3><span>{item?.variety ?? "No crop profile in the calendar catalogue"}</span></div><div className="suitability"><strong>{Math.round(prediction.class_probability * 100)}%</strong><small>model class probability</small></div></div>
                <p>{item?.explanation ?? "The model returned this crop category, but this prototype has no verified cultivation profile for it."}</p>
                {item ? <>
                  <div className="crop-facts"><span><Drop size={15} />{item.water} water</span><span><CalendarBlank size={15} />{item.days} days (demo)</span></div>
                  <div className="crop-soil-fact"><small>Profile soil range</small><strong>{item.soil}</strong></div>
                  <div className="crop-soil-fact"><small>Illustrative sowing window</small><strong>{item.season}</strong></div>
                  <button className={selectedCrop === item.name ? "button-secondary full-button" : "button-primary full-button"} onClick={() => onSelect(item)}>{selectedCrop === item.name ? "Selected. Open calendar" : "Select crop"}<ArrowRight size={16} /></button>
                </> : <span className="catalog-unavailable">Calendar profile not configured</span>}
              </div>
            </article>
          );})}</div> : <EmptyInline message="The crop model returned no candidates." action="Clear the form" onAction={onRemove} />}
          <div className="comparison-panel">
            <div><span className="section-icon"><Rows size={19} /></span><div><h3>Model response</h3><p>The ranked categories come from the trained classifier; they do not account for the unmodeled field details above.</p></div></div>
            <div className="comparison-table-wrap"><table><thead><tr><th>Crop category</th><th>Class probability</th><th>Local calendar</th></tr></thead><tbody>{options.map((prediction) => <tr key={prediction.crop}><td><strong>{cropDisplayName(prediction.crop)}</strong></td><td><span className="score-label">{(prediction.class_probability * 100).toFixed(1)}%</span></td><td>{findCropByPrediction(prediction.crop) ? "Demo profile available" : "Not configured"}</td></tr>)}</tbody></table></div>
          </div>
        </section>
      )}
      <DataInsights />
    </div>
  );
}

function DataInsights() {
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [metrics, setMetrics] = useState<CropModelMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadInsights() {
      setLoading(true);
      setError("");
      try {
        const [nextSummary, metricResponse] = await Promise.all([
          requestApi("/data/summary", isDatasetSummary, controller.signal),
          requestApi("/models/metrics", isModelMetrics, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setSummary(nextSummary);
        setMetrics(metricResponse.crop_recommendation);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Dataset insights could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadInsights();
    return () => controller.abort();
  }, []);

  const missingCount = summary
    ? Object.values(summary.missing_values_after_cleaning).reduce(
      (total, value) => total + (typeof value === "number" ? value : 0),
      0,
    )
    : 0;
  return (
    <section className="panel data-insights" aria-labelledby="data-insights-title">
      <div className="section-title-row">
        <div><h3 id="data-insights-title">Crop dataset insights</h3><p>Dataset-derived summary and model evaluation; individual dataset rows are not displayed.</p></div>
        <span className="sample-tag"><Database size={13} weight="bold" />Local dataset</span>
      </div>
      {loading && !summary && <p className="data-insights-status" role="status">Loading dataset summary…</p>}
      {error && <div className="form-error" role="alert"><Warning size={16} />Dataset insights unavailable: {error}</div>}
      {summary && (
        <>
          <div className="data-insights-metrics">
            <div><span>Clean rows</span><strong>{summary.cleaned_rows.toLocaleString("en-IN")}</strong></div>
            <div><span>Model features</span><strong>{summary.feature_count}</strong></div>
            <div><span>Crop classes</span><strong>{summary.crop_categories.length}</strong></div>
            <div><span>Missing values</span><strong>{missingCount}</strong></div>
            <div><span>Excluded invalid / duplicate rows</span><strong>{summary.invalid_rows_excluded} / {summary.duplicate_rows_excluded}</strong></div>
          </div>
          {metrics && <div className="model-metrics-note">
            <strong>Held-out dataset evaluation</strong>
            <span>Accuracy {(metrics.accuracy * 100).toFixed(1)}%</span>
            <span>Macro F1 {(metrics.f1_macro * 100).toFixed(1)}%</span>
            <span>{metrics.test_rows} test rows / {metrics.class_count} classes</span>
            <small>{metrics.evaluation} This measures only the supplied dataset split, not field performance.</small>
          </div>}
          <div className="dataset-provenance">
            <span><strong>Source file</strong> {summary.source_file}</span>
            <span><strong>Date range</strong> {summary.date_range ?? "Not present in this dataset"}</span>
            <span><strong>Processed</strong> {new Date(summary.processed_at_utc).toLocaleString()}</span>
            <p>{summary.source_provenance}</p>
          </div>
          <p className="data-insights-status">{translate("Original row-level data is not provided by this page or its API.", getLanguage())}</p>
          <p className="dataset-category-note"><strong>Crop categories in source:</strong> {summary.crop_categories.join(", ")}</p>
        </>
      )}
    </section>
  );
}

function CalendarPage({
  crop,
  activities: taskList,
  initialCoordinates,
  weatherData,
  soilForm,
  sowingDate,
  daysToSowing,
  daysSince,
  remainingDays,
  currentStage,
  completed,
  filter,
  mode,
  onSowing,
  onFilter,
  onMode,
  onComplete,
  onGoMarket,
}: {
  crop: CropInfo;
  activities: Activity[];
  initialCoordinates: string;
  weatherData: WeatherData | null;
  soilForm: SoilForm;
  sowingDate: string;
  daysToSowing: number;
  daysSince: number;
  remainingDays: number;
  currentStage: string;
  completed: string[];
  filter: string;
  mode: "Timeline" | "Calendar";
  onSowing: (date: string) => void;
  onFilter: (filter: string) => void;
  onMode: (mode: "Timeline" | "Calendar") => void;
  onComplete: (id: string) => void;
  onGoMarket: () => void;
}) {
  const defaultCoordinates = initialCoordinates.split(",").map((part) => part.trim());

  type AdvisoryDay = {
    date: string;
    day_of_season: number;
    season_progress_pct: number;
    temperature_max: number;
    temperature_min: number;
    rainfall_mm: number;
    humidity_pct: number;
    cumulative_gdd: number;
    irrigation_advice: string;
    fertilizer_advice: string[];
    harvest_note: string | null;
  };
  const [advisory, setAdvisory] = useState<AdvisoryDay[]>([]);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);
  const [advisoryError, setAdvisoryError] = useState("");

  const lat = weatherData ? weatherData.latitude : Number(defaultCoordinates[0]);
  const lon = weatherData ? weatherData.longitude : Number(defaultCoordinates[1]);

  const hasCoords = Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180;

  useEffect(() => {
    if (!hasCoords) return;
    setAdvisoryLoading(true);
    setAdvisoryError("");
    fetch(`${API_BASE_URL}/predict/advisory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: lat,
        longitude: lon,
        sowing_date: sowingDate,
        crop_days: crop.days,
        nitrogen: Number(soilForm.nitrogen) || 0,
        phosphorus: Number(soilForm.phosphorus) || 0,
        potassium: Number(soilForm.potassium) || 0,
        ph: Number(soilForm.ph) || 7,
        irrigation: soilForm.irrigation,
      }),
    })
      .then((res) => res.json())
      .then((data: { daily: AdvisoryDay[] }) => {
        setAdvisory(data.daily ?? []);
        setAdvisoryLoading(false);
      })
      .catch(() => {
        setAdvisoryError("Could not load farm advisory. Check backend is running.");
        setAdvisoryLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, sowingDate, crop.days]);

  const tasks = taskList.filter((task) => {
    const done = completed.includes(activityKey(crop.name, task.id));
    const daysUntilActivity = daysBetween(localDateString(), addDays(sowingDate, task.day));
    if (filter === "Upcoming") return !done && daysUntilActivity >= 0;
    if (filter === "Due soon") return !done && daysUntilActivity >= 0 && daysUntilActivity <= 14;
    if (filter === "Completed") return done;
    return true;
  });
  const progress = Math.min(100, Math.round((daysSince / crop.days) * 100));
  const statusOf = (task: Activity) => {
    if (completed.includes(activityKey(crop.name, task.id))) return "Completed";
    const daysUntilActivity = daysBetween(localDateString(), addDays(sowingDate, task.day));
    if (daysUntilActivity < 0) return "Overdue";
    if (daysUntilActivity <= 10) return "Due soon";
    return "Upcoming";
  };
  return (
    <div className="content-stack">

      <section className="panel crop-season-banner">
        <div className="crop-season-photo"><img src={crop.image} alt={`Sample field image used with the ${crop.name} calendar`} /></div>
        <div className="crop-season-info">
          <div className="crop-season-heading"><div><span className="muted-kicker">SELECTED DEMO CROP</span><h2>{crop.name}</h2><p>{crop.variety}</p></div><SampleTag>Rule-based estimate</SampleTag></div>
          <div className="sowing-date-banner">
            <CalendarBlank size={16} />
            <label htmlFor="sowing-date-banner">Sowing date</label>
            <input id="sowing-date-banner" type="date" value={sowingDate} onChange={(event) => onSowing(event.target.value)} />
            <span className="sowing-harvest-arrow">→</span>
            <span className="sowing-harvest-label">Harvest around <strong>{dateLabel(addDays(sowingDate, crop.days))}</strong></span>
          </div>
          <div className="crop-season-stats"><div><small>Current stage</small><strong>{currentStage}</strong></div><div><small>{daysToSowing ? "Sowing starts in" : "Days since sowing"}</small><strong>{daysToSowing ? `${daysToSowing} days` : `${daysSince} days`}</strong></div><div><small>Approximate time to harvest</small><strong>{remainingDays + daysToSowing} days</strong></div></div>
          <div className="season-bar"><span style={{ width: `${Math.max(progress, 2)}%` }} /></div>
          <div className="season-bar-label"><span>{progress}% sample season progress</span><span>Approx. {crop.days} day cycle</span></div>
        </div>
      </section>
      {!hasCoords && (
        <div className="callout demo-callout"><span><MapPin size={19} /></span><p><strong>No location set.</strong> Go to Soil &amp; crop recommendations and click "Allow location access" to enable automatic daily weather advisory for this farm.</p></div>
      )}
      {hasCoords && (
        <section className="panel">
          <div className="section-title-row">
            <div><h3>Daily farm advisory — next {advisory.length} days</h3><p>Live forecast from Open-Meteo · irrigation, fertilizer &amp; harvest guidance based on your soil data</p></div>
            {advisoryLoading && <span className="data-insights-status">Loading…</span>}
          </div>
          {advisoryError && <div className="form-error" role="alert"><Warning size={16} />{advisoryError}</div>}
          {advisory.length > 0 && (
            <div className="advisory-table-wrap">
              <table className="advisory-table">
                <thead><tr><th>Date</th><th>Day</th><th>Temp (°C)</th><th>Rain (mm)</th><th>Humidity (%)</th><th>Irrigation</th><th>Fertilizer</th><th>Harvest</th></tr></thead>
                <tbody>
                  {advisory.map((day) => (
                    <tr key={day.date} className={day.harvest_note ? "advisory-row-harvest" : day.fertilizer_advice[0] !== "No fertilizer action needed today." ? "advisory-row-fertilizer" : ""}>
                      <td><strong>{day.date}</strong></td>
                      <td>{day.day_of_season}</td>
                      <td>{day.temperature_min}–{day.temperature_max}</td>
                      <td>{day.rainfall_mm}</td>
                      <td>{day.humidity_pct}</td>
                      <td>{day.irrigation_advice}</td>
                      <td>{day.fertilizer_advice.join(" ")}</td>
                      <td>{day.harvest_note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      <section className="panel calendar-toolbar">
        <div className="calendar-controls">
          <label className="compact-select"><span>Show</span><select value={filter} onChange={(event) => onFilter(event.target.value)}><option>All activities</option><option>Upcoming</option><option>Due soon</option><option>Completed</option></select></label>
          <div className="segmented-control" role="group" aria-label="Calendar display"><button className={mode === "Timeline" ? "selected" : ""} onClick={() => onMode("Timeline")}><ListChecks size={15} />Timeline</button><button className={mode === "Calendar" ? "selected" : ""} onClick={() => onMode("Calendar")}><CalendarBlank size={15} />Calendar</button></div>
        </div>
      </section>
      <div className="calendar-layout">
        <section className="panel calendar-main">
          <div className="section-title-row"><div><h3>{mode === "Timeline" ? "Crop activity plan" : "Activity calendar"}</h3><p>Dates shift with your chosen sowing date</p></div><span className="activity-count">{tasks.length} activities</span></div>
          {tasks.length === 0 ? <EmptyInline message="There are no activities in this filter." action="Show all activities" onAction={() => onFilter("All activities")} /> : mode === "Timeline" ? (
            <div className="timeline">
              {tasks.map((task) => {
                const status = statusOf(task);
                const key = activityKey(crop.name, task.id);
                return <article className={`timeline-item${completed.includes(key) ? " is-complete" : ""}`} key={task.id}>
                  <div className="timeline-rail"><span className="timeline-marker">{completed.includes(key) ? <Check size={12} weight="bold" /> : <Circle size={8} weight="fill" />}</span><span className="timeline-line" /></div>
                  <div className="timeline-card">
                    <div className="timeline-main">
                      <div><div className="timeline-meta"><span className={`status-pill status-${status.toLowerCase().replace(" ", "-")}`}>{status}</span><span>{task.stage}</span></div><h4>{task.title}</h4><p>{task.description}</p></div>
                      <div className="timeline-date"><CalendarBlank size={14} />{dateLabel(addDays(sowingDate, task.day))}{task.duration ? <small>to {dateLabel(addDays(sowingDate, task.day + task.duration))}</small> : null}</div>
                    </div>
                    <button className={`task-action${completed.includes(key) ? " marked" : ""}`} onClick={() => onComplete(key)}>{completed.includes(key) ? <><Check size={14} />Completed</> : "Mark complete"}</button>
                  </div>
                </article>;
              })}
            </div>
          ) : (
            <MonthCalendar
              crop={crop}
              activities={taskList}
              sowingDate={sowingDate}
              completed={completed}
              onComplete={onComplete}
            />
          )}
        </section>
        <aside className="calendar-aside">
          <section className="panel stage-panel"><div className="section-title-row"><div><h3>Growth stages</h3><p>Dates from your sowing date</p></div></div><div className="stage-list">{crop.stages.map((stage, index) => <div className={`stage-row${daysSince >= stage.day ? " stage-passed" : ""}`} key={`${stage.name}-${stage.day}`}><span className="stage-mark">{daysSince >= stage.day ? <Check size={11} weight="bold" /> : index + 1}</span><span>{stage.name}</span><small>{dateLabel(addDays(sowingDate, stage.day), { day: "numeric", month: "short" })}</small></div>)}</div></section>
          <section className="sample-weather"><span className="weather-icon"><CloudSun size={20} /></span><div><span className="muted-kicker">SAMPLE WEATHER ALERT</span><strong>Rainfall check suggested</strong><p>Illustrative reminder only. Review a trusted local forecast.</p></div></section>
          <button className="button-primary full-button" onClick={onGoMarket}>Continue to harvest planning <ArrowRight size={16} /></button>
        </aside>
      </div>
    </div>
  );
}

function MarketPage({
  crop,
  quantity,
  unit,
  harvestDate,
  grade,
  sellCost,
  transportCost,
  futurePrice,
  storageLoss,
  storageCost,
  selectedMarket,
  basePrice,
  sellGross,
  sellNet,
  saleableQuantity,
  saleableQuintals,
  sellQuintals,
  storeNet,
  storeDelta,
  onUpdate,
  onMarket,
  onSell,
  onStore,
}: {
  crop: CropInfo | null;
  quantity: number;
  unit: string;
  harvestDate: string;
  grade: string;
  sellCost: number;
  transportCost: number;
  futurePrice: number;
  storageLoss: number;
  storageCost: number;
  selectedMarket: number;
  basePrice: number;
  sellGross: number;
  sellNet: number;
  saleableQuantity: number;
  saleableQuintals: number;
  sellQuintals: number;
  storeNet: number;
  storeDelta: number;
  onUpdate: (values: Partial<DemoState>) => void;
  onMarket: (index: number) => void;
  onSell: () => void;
  onStore: () => void;
}) {
  const [compareOpen, setCompareOpen] = useState(false);
  const [storageCrop, setStorageCrop] = useState(
    storageModelCrops.includes(crop?.name ?? "") ? crop?.name ?? "Tomato" : "Tomato",
  );
  const [storageState, setStorageState] = useState("");
  const [storageDistrict, setStorageDistrict] = useState("");
  const [storageMarket, setStorageMarket] = useState("");
  const [storagePrediction, setStoragePrediction] = useState<StoragePredictionResponse | null>(null);
  const [storagePredictionError, setStoragePredictionError] = useState("");
  const [storagePredictionLoading, setStoragePredictionLoading] = useState(false);
  const predictStoreSell = async () => {
    setStoragePredictionLoading(true);
    setStoragePredictionError("");
    setStoragePrediction(null);
    try {
      const response = await fetch(`${API_BASE_URL}/predict/storage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crop: storageCrop,
          state: storageState.trim() || null,
          district: storageDistrict.trim() || null,
          market: storageMarket.trim() || null,
          mode: "auto",
        }),
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("The API returned an unreadable response.");
      }
      if (!response.ok) {
        const detail = isRecord(payload) && typeof payload.detail === "string" ? payload.detail : "";
        throw new Error(detail || `Request failed with status ${response.status}.`);
      }
      if (!isStoragePredictionResponse(payload)) {
        throw new Error("The API returned an unexpected storage-model response.");
      }
      setStoragePrediction(payload);
    } catch (error) {
      console.error("Could not run store-or-sell prediction.", error);
      setStoragePredictionError(
        error instanceof Error
          ? error.message
          : translate("Could not run storage prediction. Check that the backend and model are ready.", getLanguage()),
      );
    } finally {
      setStoragePredictionLoading(false);
    }
  };
  const weeklyPrices = samplePriceHistory(basePrice);
  const chartMin = basePrice * 0.8;
  const chartMax = basePrice * 1.2;
  const chartPoints = weeklyPrices.map((value, index) => {
    const x = (index / (weeklyPrices.length - 1)) * 100;
    const y = 90 - ((value - chartMin) / (chartMax - chartMin)) * 80;
    return `${x.toFixed(2)} ${Math.max(10, Math.min(90, y)).toFixed(2)}`;
  });
  const chartPath = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point}`).join(" ");
  const chartAreaPath = `M 0 100 L ${chartPoints.join(" L ")} L 100 100 Z`;
  const yAxisValues = [Math.round(chartMax), Math.round(basePrice), Math.round(chartMin)];
  return (
    <div className="content-stack">
      <div className="callout demo-callout"><span><Database size={18} /></span><p><strong>Sample market information.</strong> Market names, prices, and history below are illustrative and not live or verified. These calculations are a planning demo, not financial advice or a price forecast.</p></div>
      <div className="market-top-grid">
        <section className="panel harvest-form-panel">
          <div className="section-title-row"><div><h3>Harvest details</h3><p>Adjust sample values to update return estimates</p></div><span className="section-icon"><Package size={20} /></span></div>
          <div className="harvest-form-grid">
            <Field label="Harvested crop"><select value={crop?.name ?? ""} onChange={(event) => { const selected = crops.find((item) => item.name === event.target.value); onUpdate({ selectedCrop: selected?.name ?? null }); }}><option value="">Choose crop</option>{crops.map((item) => <option key={item.name}>{item.name}</option>)}</select></Field>
            <Field label="Harvest date"><input type="date" value={harvestDate} onChange={(event) => onUpdate({ harvestDate: event.target.value })} /></Field>
            <Field label="Harvested quantity"><input type="number" min="0" step="0.1" value={quantity} onChange={(event) => onUpdate({ quantity: Math.max(0, Number(event.target.value)) })} /></Field>
            <Field label="Quantity unit"><select value={unit} onChange={(event) => onUpdate({ unit: event.target.value })}><option>quintals</option><option>tonnes</option><option>kilograms</option></select></Field>
            <Field label="Produce quality / grade"><select value={grade} onChange={(event) => onUpdate({ grade: event.target.value })}><option>Standard</option><option>FAQ sample</option><option>Premium sample</option><option>Needs grading</option></select></Field>
            <Field label="Selling and handling costs (₹)"><input type="number" min="0" step="50" value={sellCost} onChange={(event) => onUpdate({ sellCost: Math.max(0, Number(event.target.value)) })} /></Field>
            <Field label="Transport costs (₹)"><input type="number" min="0" step="50" value={transportCost} onChange={(event) => onUpdate({ transportCost: Math.max(0, Number(event.target.value)) })} /></Field>
          </div>
        </section>
        <section className="panel price-chart-panel">
          <div className="section-title-row"><div><h3>Sample market snapshot</h3><p>{translate(`${crop?.name ?? "Rice"} at ${markets[selectedMarket].name}. Price per quintal.`, getLanguage())}</p></div><SampleTag>Not live</SampleTag></div>
          <div className="price-main"><div><strong>{formatRupees(basePrice)}</strong><span>per quintal</span></div><span className="change-badge">{translate(`${markets[selectedMarket].change} sample change`, getLanguage())}</span></div>
          <div className="chart-area">
            <div className="chart-y-labels">{yAxisValues.map((value) => <span key={value}>{formatRupees(value)}</span>)}</div>
            <svg className="price-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-labelledby="chart-title chart-description">
              <title id="chart-title">{translate("Illustrative 12-week sample price history", getLanguage())}</title>
              <desc id="chart-description">{translate(`Prices are shown in rupees per quintal for ${crop?.name ?? "Rice"} at ${markets[selectedMarket].name}. All values are sample data, not live rates.`, getLanguage())}</desc>
              <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--green)" stopOpacity=".18" /><stop offset="100%" stopColor="var(--green)" stopOpacity="0" /></linearGradient></defs>
              <path d={chartAreaPath} fill="url(#chartFill)" />
              <path d={chartPath} fill="none" stroke="var(--green)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="chart-x-labels"><span>12 weeks ago</span><span>6 weeks ago</span><span>Sample now</span></div>
          </div>
          <div className="market-mini-list">{markets.map((market, index) => <button key={market.name} className={selectedMarket === index ? "selected" : ""} onClick={() => onMarket(index)}><span>{market.name}</span><strong>{formatRupees(Math.round((crop?.pricePerQuintal ?? 2280) * market.priceFactor))}</strong><em className={market.change.startsWith("-") ? "negative-change" : ""}>{market.change}</em></button>)}</div>
          <button className="text-link chart-expand" aria-expanded={compareOpen} onClick={() => setCompareOpen((value) => !value)}>{compareOpen ? "Hide sample history values" : "View sample history values"}<ArrowRight size={14} /></button>
          {compareOpen && <div className="expanded-market-note"><strong>Weekly sample values per quintal</strong><p>{translate(`Illustrative history for ${crop?.name ?? "Rice"} at ${markets[selectedMarket].name}. Confirm current rates with a verified market source.`, getLanguage())}</p><div className="price-history-list">{weeklyPrices.map((price, index) => <span key={`${index}-${price}`}>{translate(`Week ${index + 1}`, getLanguage())}<strong>{formatRupees(price)}</strong></span>)}</div></div>}
        </section>
      </div>
      <div className="sell-store-heading"><div><p className="eyebrow">DECISION SUPPORT</p><h2>Compare the two sample scenarios</h2><p>Change quantities and assumptions to see the estimated returns update.</p></div><SampleTag>Illustrative math</SampleTag></div>
      <div className="decision-grid">
        <section className="decision-card sell-card">
          <div className="decision-card-head"><span className="decision-icon"><ArrowUpRight size={19} /></span><span className="scenario-label">OPTION A</span><SampleTag>Sell now</SampleTag></div>
          <h3>Sell your harvest now</h3><p>Estimates use the selected market's sample price and your entered harvest quantity.</p>
          <div className="calculation-list"><div><span>Quantity to sell</span><strong>{translate(`${quantity} ${unit} (${sellQuintals.toFixed(2)} quintals)`, getLanguage())}</strong></div><div><span>Illustrative price / quintal</span><strong>{formatRupees(basePrice)}</strong></div><div><span>Estimated gross revenue</span><strong>{formatRupees(sellGross)}</strong></div><div><span>Selling and handling</span><strong>- {formatRupees(sellCost)}</strong></div><div><span>Transport</span><strong>- {formatRupees(transportCost)}</strong></div></div>
          <div className="net-total"><span>Estimated net return</span><strong>{formatRupees(sellNet)}</strong></div>
          <button className="button-primary full-button" onClick={onSell}>Review sell-now demo <ArrowRight size={16} /></button>
          <small className="card-disclaimer">No market order or sale will be placed.</small>
        </section>
        <section className="decision-card store-card">
          <div className="decision-card-head"><span className="decision-icon"><Warehouse size={19} /></span><span className="scenario-label">OPTION B</span><SampleTag>Store later</SampleTag></div>
          <h3>Store and review later</h3><p>Explore what-if values. Future prices, storage loss, and fees are assumptions, not a forecast.</p>
          <div className="assumption-grid">
            <Field label="Assumed future price / quintal (₹)"><input type="number" min="0" step="50" value={futurePrice} onChange={(event) => onUpdate({ futurePrice: Math.max(0, Number(event.target.value)) })} /></Field>
            <Field label="Assumed quantity loss (%)"><input type="number" min="0" max="100" step="0.5" value={storageLoss} onChange={(event) => onUpdate({ storageLoss: Math.min(100, Math.max(0, Number(event.target.value))) })} /></Field>
            <Field label="Storage and handling (₹)"><input type="number" min="0" step="50" value={storageCost} onChange={(event) => onUpdate({ storageCost: Math.max(0, Number(event.target.value)) })} /></Field>
          </div>
          <div className="storage-assumptions"><span>Saleable quantity</span><strong>{translate(`${saleableQuantity.toFixed(1)} ${unit}`, getLanguage())}</strong><small>{translate(`${saleableQuintals.toFixed(2)} quintals after ${storageLoss}% assumed storage loss`, getLanguage())}</small></div>
          <div className="calculation-list compact"><div><span>Assumed future price / quintal</span><strong>{formatRupees(futurePrice)}</strong></div><div><span>Illustrative gross revenue</span><strong>{formatRupees(saleableQuintals * futurePrice)}</strong></div><div><span>Storage + transport costs</span><strong>- {formatRupees(storageCost + transportCost)}</strong></div></div>
          <div className="net-total"><span>Estimated later net return</span><strong>{formatRupees(storeNet)}</strong></div>
          <div className={`scenario-difference${storeDelta < 0 ? " lower" : ""}`}>{storeDelta >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />} {translate(`${formatRupees(Math.abs(storeDelta))} ${storeDelta >= 0 ? "above" : "below"} the sell-now estimate under these assumptions`, getLanguage())}</div>
          <button className="button-secondary full-button" onClick={onStore}>Browse sample storage <ArrowRight size={16} /></button>
          <small className="card-disclaimer">A higher assumed future price does not guarantee a better return.</small>
        </section>
      </div>
      <section className="panel storage-model-panel">
        <div className="section-title-row">
          <div>
            <h3>{translate("Storage model prediction", getLanguage())}</h3>
            <p>{translate("Uses local historical prices offline; when configured and online, it adds current government market prices.", getLanguage())}</p>
          </div>
          <span className="section-icon"><Warehouse size={20} /></span>
        </div>
        <div className="harvest-form-grid">
          <Field label={translate("Storage prediction crop", getLanguage())}>
            <select value={storageCrop} onChange={(event) => setStorageCrop(event.target.value)}>
              {storageModelCrops.map((name) => <option key={name} value={name}>{translate(name, getLanguage())}</option>)}
            </select>
          </Field>
          <Field label={translate("State (optional)", getLanguage())}>
            <input value={storageState} onChange={(event) => setStorageState(event.target.value)} placeholder={translate("For example, Andhra Pradesh", getLanguage())} />
          </Field>
          <Field label={translate("District (optional)", getLanguage())}>
            <input value={storageDistrict} onChange={(event) => setStorageDistrict(event.target.value)} />
          </Field>
          <Field label={translate("Market (optional)", getLanguage())}>
            <input value={storageMarket} onChange={(event) => setStorageMarket(event.target.value)} />
          </Field>
        </div>
        <button className="button-primary" onClick={() => void predictStoreSell()} disabled={storagePredictionLoading}>
          {storagePredictionLoading ? translate("Running model...", getLanguage()) : translate("Predict store or sell", getLanguage())}
          <ArrowRight size={16} />
        </button>
        {storagePredictionError && <p className="field-error" role="alert">{storagePredictionError}</p>}
        {storagePrediction && (
          <div className="storage-model-result" aria-live="polite">
            <div className="decision-card-head">
              <span className="scenario-label">{translate("Model result", getLanguage())}</span>
              <SampleTag>{translate(storagePrediction.data_mode === "online" ? "Online current + historical data" : "Offline historical data", getLanguage())}</SampleTag>
            </div>
            <h4>{translate(storagePrediction.decision, getLanguage())} · {translate(storagePrediction.crop, getLanguage())}</h4>
            <p>
              {translate("Model class score", getLanguage())}: {(storagePrediction.class_probability * 100).toFixed(1)}%
              {" · "}{formatRupees(storagePrediction.market.modal_price_per_quintal)} {translate("per quintal", getLanguage())}
            </p>
            <p>{storagePrediction.market.name}, {storagePrediction.market.district}, {storagePrediction.market.state} · {translate("Price date", getLanguage())}: {dateLabel(storagePrediction.market.arrival_date)}</p>
            <p>{translate("Training data", getLanguage())}: {dateLabel(storagePrediction.historical_training_range.start)} – {dateLabel(storagePrediction.historical_training_range.end)}</p>
            {storagePrediction.model_evaluation && <p>{translate("Historical test accuracy", getLanguage())}: {(storagePrediction.model_evaluation.accuracy * 100).toFixed(1)}% ({storagePrediction.model_evaluation.test_rows.toLocaleString(getIntlLocale())} {translate("test records", getLanguage())})</p>}
            {storagePrediction.offline_reason && <p role="status">{translate("Online prices unavailable; using local data.", getLanguage())} {storagePrediction.offline_reason}</p>}
            <small>{translate("Experimental historical-pattern model only. The score is not a calibrated forecast or a guarantee; verify local prices and storage costs before deciding.", getLanguage())}</small>
          </div>
        )}
      </section>
    </div>
  );
}

function StoragePage({
  crop,
  facilities: entries,
  type,
  maxCost,
  locationFilter,
  condition,
  monitoring,
  selectedFacility,
  reserved,
  onType,
  onCost,
  onLocationFilter,
  onCondition,
  onMonitoring,
  onProviderPortal,
  onDetails,
  onSelect,
}: {
  crop: CropInfo | null;
  facilities: Facility[];
  type: string;
  maxCost: number;
  locationFilter: string;
  condition: string;
  monitoring: string;
  selectedFacility: string | null;
  reserved: boolean;
  onType: (type: string) => void;
  onCost: (cost: number) => void;
  onLocationFilter: (location: string) => void;
  onCondition: (condition: string) => void;
  onMonitoring: (monitoring: string) => void;
  onProviderPortal: () => void;
  onDetails: (facility: Facility) => void;
  onSelect: (facility: Facility) => void;
}) {
  const [locationGranted, setLocationGranted] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  function requestStorageLocation() {
    if (!("geolocation" in navigator)) return;
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const label = `${position.coords.latitude.toFixed(3)}, ${position.coords.longitude.toFixed(3)}`;
        onLocationFilter(label);
        setLocationGranted(true);
        setLocationLoading(false);
      },
      () => setLocationLoading(false),
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 60000 },
    );
  }

  const [costFacilityId, setCostFacilityId] = useState<string | null>(null);
  const [storedQuantity, setStoredQuantity] = useState(5);
  const [storedUnit, setStoredUnit] = useState<"tonnes" | "kilograms">("tonnes");
  const [storageDays, setStorageDays] = useState(7);
  function estimateStorageCost(facility: Facility) {
    const billableDays = Math.max(facility.minimumDays, storageDays);
    const normalizedQuantity = facility.pricingUnit === "per tonne per day"
      ? storedUnit === "tonnes" ? storedQuantity : storedQuantity / 1000
      : storedUnit === "kilograms" ? storedQuantity : storedQuantity * 1000;
    const base = facility.pricingUnit === "per facility per day"
      ? facility.dailyPrice * billableDays
      : facility.dailyPrice * normalizedQuantity * billableDays;
    return base + facility.handlingFee + facility.loadingFee;
  }
  return (
    <div className="content-stack">
      <div className="callout demo-callout"><span><Warehouse size={19} /></span><p><strong>Storage listings.</strong> Facilities shown here are added locally by storage providers. Availability, capacity, fees, and condition are provider-entered; confirm details before making plans.</p></div>
      <section className="location-access-card" aria-label="Device location access for storage">
        <div><MapPin size={19} /><span><strong>Find storage near you</strong><small>Optional. Uses your device location to filter storage facilities by area. Location is not saved.</small></span></div>
        <button type="button" className="button-secondary location-button" onClick={requestStorageLocation} disabled={locationLoading}>
          <Compass size={17} />{locationLoading ? "Locating…" : locationGranted ? "Update location" : "Use my location"}
        </button>
      </section>
      <div className="storage-heading-row"><div><h2>{crop ? `Storage for ${crop.name}` : "Storage locations"}</h2><p>Browse provider-entered facilities and check their details.</p></div><button className="button-primary" onClick={onProviderPortal}>Storage Provider Portal <ArrowRight size={15} /></button></div>
      {selectedFacility && reserved && <div className="inline-success storage-confirmation" role="status"><CheckCircle size={18} />Demo selection saved for {entries.find((facility) => facility.id === selectedFacility)?.name ?? "the selected facility"}. No reservation was made.</div>}
      <div className="storage-layout">
        <aside className="panel storage-filters">
          <div className="section-title-row"><div><h3>Filters</h3><p>Filter available facilities</p></div><span className="section-icon"><Rows size={18} /></span></div>
          <Field label="Facility name or location"><input value={locationFilter} onChange={(event) => onLocationFilter(event.target.value)} placeholder="Search facilities" /></Field>
          <Field label="Storage type"><select value={type} onChange={(event) => onType(event.target.value)}><option>All types</option><option>Warehouse</option><option>Grain storage</option><option>Cold storage</option></select></Field>
          <Field label="Facility condition"><select value={condition} onChange={(event) => onCondition(event.target.value)}><option>All conditions</option><option>Excellent</option><option>Good</option><option>Needs Maintenance</option><option>Critical</option></select></Field>
          <Field label="Monitoring devices"><select value={monitoring} onChange={(event) => onMonitoring(event.target.value)}><option>Any monitoring</option><option>Monitoring configured</option><option>No monitoring configured</option></select></Field>
          <Field label={`Max sample daily rate: ${formatRupees(maxCost)} per tonne equivalent`} hint="Compared for one tonne over one day. A facility daily rate is used as entered."><input type="range" min="0" max="100" step="1" value={maxCost * 10} onChange={(event) => onCost(Number(event.target.value) / 10)} /><span className="range-values"><small>₹0</small><small>₹10</small></span></Field>
          <div className="filter-crop-note"><Leaf size={16} /><span>{crop ? `Showing sites compatible with ${crop.name}.` : "Select a crop to filter by crop compatibility."}</span></div>
          <button className="button-quiet" onClick={() => { onLocationFilter(""); onType("All types"); onCost(10); onCondition("All conditions"); onMonitoring("Any monitoring"); }}>Reset filters</button>
        </aside>
        <section className="storage-results">
          <div className="storage-results-head"><span>{translate(`${entries.length} facilities`, getLanguage())}</span><span>Provider-entered listings</span></div>
          {entries.length ? entries.map((facility) => (
            <article className="panel facility-row" key={facility.id}>
              <div className="facility-symbol"><Warehouse size={22} /></div>
              <div className="facility-main"><div className="facility-name-row"><h3>{facility.name}</h3><SampleTag>Provider entry</SampleTag></div><p>{facility.type} <span /> {facility.locality}, {facility.sampleDistrict}</p><div className="facility-tags">{facility.crops.map((item) => <span key={item}>{item}</span>)}</div><div className="facility-tags"><span className={`provider-status condition-${facility.condition.toLowerCase().replaceAll(" ", "-")}`}>{facility.condition} / provider-reported</span><span className={`provider-status availability-${facility.availability.toLowerCase().replaceAll(" ", "-")}`}>{facility.availability}</span><span>{facility.devices.some((device) => device.enabled && device.temperature !== null) ? "Temperature monitoring configured" : "No temperature monitor"}</span><span>{facility.devices.some((device) => device.enabled && device.humidity !== null) ? "Humidity monitoring configured" : "No humidity monitor"}</span></div></div>
              <div className="facility-stat"><small>Available capacity</small><strong>{Math.max(0, facility.capacity - facility.occupiedCapacity)} / {facility.capacity} {facility.capacityUnit}</strong></div>
              <div className="facility-stat"><small>Daily price</small><strong>{formatStorageRate(facility.dailyPrice)}<small> / {facility.pricingUnit}</small></strong></div>
              <div className="facility-actions"><button className="button-quiet" onClick={() => onDetails(facility)}>View details</button><button className="button-secondary" onClick={() => { setCostFacilityId(costFacilityId === facility.id ? null : facility.id); setStorageDays(Math.max(facility.minimumDays, storageDays)); }} aria-expanded={costFacilityId === facility.id}>Calculate storage cost</button><button className="button-primary" disabled={facility.availability === "Unavailable" || facility.capacity <= facility.occupiedCapacity} onClick={() => onSelect(facility)}>{facility.availability === "Unavailable" || facility.capacity <= facility.occupiedCapacity ? "Unavailable" : selectedFacility === facility.id && reserved ? "Demo selected" : "Select facility"}<ArrowRight size={15} /></button></div>
              {costFacilityId === facility.id && <div className="farmer-cost-calculator">
                <strong>Storage cost</strong>
                <div>
                  <label>Quantity<input type="number" min="0" step="0.1" value={storedQuantity} onChange={(event) => setStoredQuantity(Math.max(0, Number(event.target.value)))} /></label>
                  <label>Unit<select value={storedUnit} onChange={(event) => setStoredUnit(event.target.value as typeof storedUnit)}><option value="tonnes">Tonnes</option><option value="kilograms">Kilograms</option></select></label>
                  <label>Days<input type="number" min={facility.minimumDays} step="1" value={Math.max(facility.minimumDays, storageDays)} onChange={(event) => setStorageDays(Math.max(facility.minimumDays, Number(event.target.value)))} /></label>
                </div>
                <p>{facility.dailyPrice} ₹ {facility.pricingUnit}, plus {formatRupees(facility.handlingFee + facility.loadingFee)} entered fees. Minimum {facility.minimumDays} day(s).</p>
                <b>Estimated total: {formatRupees(estimateStorageCost(facility))}</b>
                <small>Illustrative calculation only. No booking or payment is made.</small>
              </div>}
            </article>
          )) : <section className="panel storage-empty"><span><Warehouse size={25} /></span><h3>No storage facilities available yet</h3><p>Storage providers can add their facilities from the Provider Portal.</p><button className="button-secondary" onClick={onProviderPortal}>Open Provider Portal</button></section>}
          <div className="storage-contact-note"><MapPin size={16} /><span>Facility details are provider-entered. Verify availability, pricing, and condition before selecting a facility.</span></div>
        </section>
      </div>
    </div>
  );
}

function FarmPage({
  crop,
  area,
  unit,
  form,
  language,
  onNavigate,
}: {
  crop: CropInfo | null;
  area: string;
  unit: string;
  form: SoilForm;
  language: Language;
  onNavigate: (view: View) => void;
}) {
  function downloadSummary() {
    const summary = [
      "FarmShield demo farm summary",
      `Device location access: ${form.coordinates ? "Granted for this session" : "Not granted"}`,
      `Farm area: ${area ? `${area} ${unit}` : "Not set"}`,
      `Selected crop: ${crop?.name ?? "Not selected"}`,
      "",
      "This file contains demo information only. It is not agronomic advice.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([summary], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "farmshield-demo-summary.txt";
    link.click();
    URL.revokeObjectURL(url);
  }
  const rows = [
    ["Device location", form.coordinates ? "Granted for this session" : "Not granted"],
    ["Farm area", area ? `${area} ${unit}` : "Not entered"],
    ["Selected crop", crop?.name ?? "Not selected"],
    ["Soil type", form.soil || "Not entered"],
    ["Water availability", form.water || "Not entered"],
    ["Irrigation", form.irrigation || "Not entered"],
  ];
  return (
    <div className="content-stack">
      <div className="callout demo-callout"><span><Database size={18} /></span><p>This farm profile is a local demo. It is saved in this browser only. Do not enter information you do not want stored on this device.</p></div>
      <div className="farm-page-grid">
        <section className="panel farm-profile-panel">
          <div className="farm-profile-cover" role="img" aria-label={translate("Sample cultivated farm landscape", language)} />
          <div className="farm-person-row"><div className="farm-profile-avatar">RK</div><div><h2>Ramesh Kumar</h2><p>Demo farmer profile</p></div><SampleTag /></div>
          <div className="farm-details-list">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
          <div className="farm-panel-actions"><button className="button-primary" onClick={() => onNavigate("Soil & crop recommendations")}><Plus size={16} />Update farm details</button><button className="button-secondary" onClick={downloadSummary}><DownloadSimple size={16} />Download demo summary</button></div>
        </section>
        <aside className="farm-side-stack">
          <section className="panel farm-crop-panel"><span className="section-icon"><Plant size={20} /></span><h3>{crop ? `${crop.name} selected` : "No crop selected"}</h3><p>{crop ? `${crop.variety}. Your sample cultivation calendar is ready.` : "Explore the sample options and choose a crop to start a calendar."}</p><button className="text-link" onClick={() => onNavigate(crop ? "Crop calendar" : "Soil & crop recommendations")}>{crop ? "Open crop calendar" : "Explore crop options"}<ArrowRight size={14} /></button></section>
          <section className="farm-tip-panel"><span><Flower size={20} /></span><div><strong>Local guidance matters</strong><p>FarmShield demo suggestions do not replace soil testing, extension services, or verified local advice.</p></div></section>
          <section className="panel farm-data-panel"><div className="section-title-row"><div><h3>Privacy note</h3><p>Demo details stay on this browser.</p></div></div><p>There is no account, backend, database, or cloud sync connected to this prototype. Reset demo data to clear the saved profile from this browser.</p></section>
        </aside>
      </div>
    </div>
  );
}

function SettingsPage({
  language,
  dark,
  onLanguage,
  onDark,
  onReset,
}: {
  language: Language;
  dark: boolean;
  onLanguage: (language: Language) => void;
  onDark: (dark: boolean) => void;
  onReset: () => void;
}) {
  return (
    <div className="settings-layout">
      <section className="panel settings-main">
        <div className="section-title-row"><div><h3>Display preferences</h3><p>Settings are saved in this browser.</p></div><span className="section-icon"><ClipboardText size={20} /></span></div>
        <div className="setting-row"><div className="setting-icon"><GlobeHemisphereWest size={19} /></div><div className="setting-copy"><strong>Language</strong><small>Choose a language for all pages.</small></div><LanguageSelect language={language} onChange={onLanguage} /></div>
        <div className="setting-row"><div className="setting-icon">{dark ? <Moon size={19} /> : <Sun size={19} />}</div><div className="setting-copy"><strong>Appearance</strong><small>Switch between light and dark display.</small></div><button className={`theme-switch${dark ? " on" : ""}`} role="switch" aria-checked={dark} onClick={() => onDark(!dark)}><span />{dark ? "Dark" : "Light"}</button></div>
        <div className="setting-row"><div className="setting-icon"><Bell size={19} /></div><div className="setting-copy"><strong>Sample notifications</strong><small>Weather and crop reminders are simulated, not live.</small></div><span className="setting-status">Demo only</span></div>
      </section>
      <section className="panel reset-panel"><span className="reset-icon"><Warning size={20} /></span><h3>Reset demo journey</h3><p>Clear the local sample crop, soil entries, completed activities, market assumptions, and display preferences.</p><button className="button-danger" onClick={onReset}>Reset demo data</button></section>
      <section className="settings-note"><Database size={17} /><p>FarmShield is a frontend-only demo. Prices, crop suitability, weather notes, market records, and storage facilities are not verified real-world information.</p></section>
    </div>
  );
}

function EmptyPanel({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) {
  return <section className="panel empty-panel"><span><Plant size={27} /></span><h2>{title}</h2><p>{description}</p><button className="button-primary" onClick={onAction}>{action}<ArrowRight size={16} /></button></section>;
}

function RoleSelection({ onSelect, language, onLanguage }: { onSelect: (mode: "farmer" | "provider") => void; language: Language; onLanguage: (language: Language) => void }) {
  return (
    <main className="role-selection">
      <div className="role-selection-shell">
        <header className="role-selection-brand">
          <span className="brand-mark"><Leaf size={21} weight="fill" /></span>
          <span className="brand-name">Farm<span>Shield</span></span>
          <span className="role-demo-label">Decision-support demo</span>
          <LanguageSelect language={language} onChange={onLanguage} />
        </header>
        <section className="role-selection-intro" aria-labelledby="role-selection-title">
          <p className="eyebrow">A workspace for better farm decisions</p>
          <h1 id="role-selection-title">Where would you like to start?</h1>
          <p>Choose the tools for your work. This is navigation for a prototype, not an account or identity check.</p>
        </section>
        <div className="role-card-grid">
          <button className="role-card farmer-role-card" type="button" onClick={() => onSelect("farmer")}>
            <span className="role-card-image farmer-role-image" aria-hidden="true">
              <span className="role-card-illustration"><Farm size={58} weight="regular" /></span>
              <span className="role-card-icon"><Farm size={22} weight="regular" /></span>
            </span>
            <span className="role-card-copy">
              <span className="role-card-kicker">FIELD PLANNING</span>
              <span className="role-card-title">Farmer</span>
              <span className="role-card-description">Explore crop options, keep a growing calendar, estimate harvest plans, compare sample market scenarios, and find storage listings.</span>
              <span className="role-card-action">Continue as Farmer <ArrowRight size={17} /></span>
            </span>
          </button>
          <button className="role-card provider-role-card" type="button" onClick={() => onSelect("provider")}>
            <span className="role-card-image provider-role-image" aria-hidden="true">
              <span className="provider-role-illustration"><Warehouse size={62} weight="light" /><span className="provider-role-ground" /></span>
              <span className="role-card-icon"><Warehouse size={22} weight="regular" /></span>
            </span>
            <span className="role-card-copy">
              <span className="role-card-kicker">FACILITY MANAGEMENT</span>
              <span className="role-card-title">Storage Provider</span>
              <span className="role-card-description">Manage facility details, supported crops, capacity, pricing, availability, maintenance notes, and simulated monitoring devices.</span>
              <span className="role-card-action">Continue as Storage Provider <ArrowRight size={17} /></span>
            </span>
          </button>
        </div>
        <p className="role-selection-footnote">Demo facility records are stored in this browser and shared between both workspaces. No sign-in or permission checks are implemented.</p>
      </div>
    </main>
  );
}

function MonthCalendar({
  crop,
  activities: taskList,
  sowingDate,
  completed,
  onComplete,
}: {
  crop: CropInfo;
  activities: Activity[];
  sowingDate: string;
  completed: string[];
  onComplete: (key: string) => void;
}) {
  const [viewDate, setViewDate] = useState(() => {
    const [y, m] = sowingDate.split("-").map(Number);
    return { year: y, month: m };
  });

  // Stage colour bands: map each day of the season to a stage index
  const stageColors = [
    "#e8f5e9", "#c8e6c9", "#a5d6a7", "#81c784", "#66bb6a", "#4caf50",
  ];
  const harvestColor = "#fff9c4";

  function stageForDay(dayOffset: number): number {
    if (dayOffset < 0 || dayOffset > crop.days) return -1;
    let idx = 0;
    for (let i = 0; i < crop.stages.length; i++) {
      if (dayOffset >= crop.stages[i].day) idx = i;
    }
    return idx;
  }

  function activitiesOnDate(isoDate: string) {
    return taskList.filter((t) => addDays(sowingDate, t.day) === isoDate);
  }

  const { year, month } = viewDate;
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(getIntlLocale(), { month: "long", year: "numeric", timeZone: "UTC" });

  function prevMonth() {
    setViewDate(({ year: y, month: m }) => m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 });
  }
  function nextMonth() {
    setViewDate(({ year: y, month: m }) => m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 });
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="month-calendar">
      <div className="month-calendar-nav">
        <button className="icon-button" onClick={prevMonth} aria-label="Previous month"><CaretLeft size={16} /></button>
        <strong>{monthLabel}</strong>
        <button className="icon-button" onClick={nextMonth} aria-label="Next month"><CaretRight size={16} /></button>
      </div>
      <div className="month-calendar-legend">
        {crop.stages.map((s, i) => (
          <span key={s.name} style={{ background: stageColors[i] ?? stageColors[stageColors.length - 1] }}>{s.name}</span>
        ))}
        <span style={{ background: harvestColor }}>Harvest</span>
      </div>
      <div className="month-calendar-grid">
        {dayNames.map((d) => <div key={d} className="month-cal-header">{d}</div>)}
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="month-cal-cell empty" />;
          const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const [sowY, sowM, sowD] = sowingDate.split("-").map(Number);
          const sowUTC = Date.UTC(sowY, sowM - 1, sowD);
          const cellUTC = Date.UTC(year, month - 1, day);
          const dayOffset = Math.round((cellUTC - sowUTC) / 86400000);
          const stageIdx = stageForDay(dayOffset);
          const isHarvest = dayOffset === crop.days;
          const bg = isHarvest ? harvestColor : stageIdx >= 0 ? (stageColors[stageIdx] ?? stageColors[stageColors.length - 1]) : undefined;
          const dayActivities = activitiesOnDate(isoDate);
          const today = localDateString();
          return (
            <div
              key={isoDate}
              className={`month-cal-cell${isoDate === today ? " month-cal-today" : ""}${dayActivities.length ? " month-cal-has-activity" : ""}`}
              style={bg ? { background: bg } : undefined}
            >
              <span className="month-cal-day-num">{day}</span>
              {dayActivities.map((task) => {
                const key = activityKey(crop.name, task.id);
                const done = completed.includes(key);
                return (
                  <button
                    key={task.id}
                    className={`month-cal-activity${done ? " done" : ""}`}
                    onClick={() => onComplete(key)}
                    title={task.title}
                    aria-label={`${task.title} — ${done ? "Mark activity incomplete" : "Mark activity complete"}`}
                  >
                    {done ? <Check size={9} weight="bold" /> : null}
                    <span>{task.title}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
