import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  FloppyDisk,
  PencilSimple,
  Plus,
  Trash,
  Warehouse,
  Warning,
} from "@phosphor-icons/react";
import { crops, formatRupees, formatStorageRate, type Facility } from "./data";

type Props = {
  facilities: Facility[];
  onSave: (facility: Facility) => void;
  onDelete: (facility: Facility) => void;
  onToggleAvailability: (facility: Facility) => void;
  onPreview: (facility: Facility) => void;
  onReset: () => void;
  onToast: (message: string) => void;
};


const conditions: Facility["condition"][] = ["Excellent", "Good", "Needs Maintenance", "Critical"];
const availabilityOptions: Facility["availability"][] = ["Available", "Limited Availability", "Unavailable"];
const storageTypes = ["General Warehouse", "Cold Storage", "Grain Storage", "Other"];

function makeDraft(): Facility {
  return {
    id: "",
    name: "",
    type: "General Warehouse",
    crops: [],
    capacity: 0,
    occupiedCapacity: 0,
    capacityUnit: "tonnes",
    charge: 0,
    dailyPrice: 0,
    pricingUnit: "per tonne per day",
    contact: "",
    sampleDistrict: "",
    distance: 0,
    country: "",
    state: "",
    locality: "",
    address: "",
    postalCode: "",
    latitude: "",
    longitude: "",
    condition: "Good",
    cleanliness: "Not entered",
    ventilation: "Not entered",
    moistureProtection: "Not entered",
    pestControl: "Not entered",
    inspectionDate: "",
    maintenanceNotes: "",
    availability: "Available",
    description: "",
    minimumDays: 1,
    handlingFee: 0,
    loadingFee: 0,
    pricingNotes: "",
    availabilityNotes: "",
    devices: [],
    updatedAt: "Not updated",
    providerManaged: true,
  };
}

function toDraft(facility: Facility): Facility {
  return { ...facility, crops: [...facility.crops], devices: facility.devices.map((device) => ({ ...device })) };
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="provider-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function StorageProviderPage({ facilities, onSave, onDelete, onToggleAvailability, onPreview, onReset, onToast }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Facility>(makeDraft);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All types");
  const [filterCondition, setFilterCondition] = useState("All conditions");
  const [filterAvailability, setFilterAvailability] = useState("All availability");
  const [quantity, setQuantity] = useState(5);
  const [quantityUnit, setQuantityUnit] = useState<"tonnes" | "kilograms">("tonnes");
  const [duration, setDuration] = useState(7);

  const editingFacility = facilities.find((facility) => facility.id === editingId);
  const availableCapacity = facilities.reduce((sum, facility) =>
    sum + (facility.capacity - facility.occupiedCapacity) * (facility.capacityUnit === "kilograms" ? 0.001 : 1), 0);
  const needingMaintenance = facilities.filter((facility) =>
    facility.condition === "Needs Maintenance" || facility.condition === "Critical").length;
  const availableCount = facilities.filter((facility) =>
    facility.availability !== "Unavailable" && facility.capacity > facility.occupiedCapacity).length;

  const filteredFacilities = useMemo(() => {
    const query = search.trim().toLowerCase();
    return facilities.filter((facility) =>
      (!query || `${facility.name} ${facility.sampleDistrict} ${facility.locality} ${facility.state}`.toLowerCase().includes(query)) &&
      (filterType === "All types" || facility.type === filterType) &&
      (filterCondition === "All conditions" || facility.condition === filterCondition) &&
      (filterAvailability === "All availability" || facility.availability === filterAvailability),
    );
  }, [facilities, search, filterType, filterCondition, filterAvailability]);

  function updateDraft<K extends keyof Facility>(key: K, value: Facility[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFormError("");
  }

  function startNew() {
    setEditingId(null);
    setDraft(makeDraft());
    setFormError("");
    document.getElementById("provider-facility-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startEdit(facility: Facility) {
    setEditingId(facility.id);
    setDraft(toDraft(facility));
    setFormError("");
    document.getElementById("provider-facility-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submitFacility(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const total = Number(draft.capacity);
    const occupied = Number(draft.occupiedCapacity);
    const price = Number(draft.dailyPrice);
    const minimumDays = Number(draft.minimumDays);
    if (!draft.name.trim() || !draft.sampleDistrict.trim() || !draft.locality.trim()) {
      setFormError("Enter a facility name, district, and town or village.");
      return;
    }
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(occupied) || occupied < 0 || occupied > total) {
      setFormError("Occupied capacity must be zero or more and cannot exceed total capacity.");
      return;
    }
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(minimumDays) || minimumDays < 1) {
      setFormError("Enter a valid daily price and a minimum duration of at least one day.");
      return;
    }
    if (!Number.isFinite(Number(draft.handlingFee)) || draft.handlingFee < 0 ||
      !Number.isFinite(Number(draft.loadingFee)) || draft.loadingFee < 0) {
      setFormError("Handling and loading fees must be zero or more.");
      return;
    }
    if (!draft.crops.length) {
      setFormError("Select at least one crop accepted by this facility.");
      return;
    }
    if ((draft.latitude && (!Number.isFinite(Number(draft.latitude)) || Number(draft.latitude) < -90 || Number(draft.latitude) > 90)) ||
      (draft.longitude && (!Number.isFinite(Number(draft.longitude)) || Number(draft.longitude) < -180 || Number(draft.longitude) > 180))) {
      setFormError("Enter a valid latitude between -90 and 90 and longitude between -180 and 180.");
      return;
    }
    if (Boolean(draft.latitude) !== Boolean(draft.longitude)) {
      setFormError("Enter both latitude and longitude, or leave both blank.");
      return;
    }
    const updated: Facility = {
      ...draft,
      id: editingId ?? `provider-${crypto.randomUUID()}`,
      type: draft.type === "General Warehouse" ? "Warehouse" : draft.type,
      capacity: total,
      occupiedCapacity: occupied,
      charge: draft.pricingUnit === "per tonne per day" ? price : price * 1000,
      dailyPrice: price,
      minimumDays,
      sampleDistrict: draft.sampleDistrict.trim(),
      updatedAt: new Date().toLocaleString("en-IN"),
      providerManaged: true,
      distance: 0,
    };
    onSave(updated);
    setEditingId(updated.id);
    setDraft(toDraft(updated));
    setFormError("");
    onToast(editingId ? "Facility details updated in the shared demo list." : "Facility added to the shared demo list.");
  }

  function deleteFacility(facility: Facility) {
    if (!window.confirm(`Remove "${facility.name}" from the shared demo listings? This cannot be undone.`)) return;
    onDelete(facility);
    if (editingId === facility.id) startNew();
    onToast("Facility removed from both dashboard views.");
  }

  function requestReset() {
    if (window.confirm("Reset all demo data, including provider facilities and farmer settings?")) onReset();
  }

  const available = Math.max(0, Number(draft.capacity) - Number(draft.occupiedCapacity));
  const costBase = draft.pricingUnit === "per facility per day"
    ? draft.dailyPrice * duration
    : draft.dailyPrice *
      (draft.pricingUnit === "per tonne per day"
        ? quantityUnit === "tonnes" ? quantity : quantity / 1000
        : quantityUnit === "kilograms" ? quantity : quantity * 1000) *
      duration;
  const estimatedCost = costBase + Number(draft.handlingFee || 0) + Number(draft.loadingFee || 0);

  return (
    <div className="provider-workspace">
      <div className="callout demo-callout provider-disclosure"><span><Warehouse size={19} /></span><p><strong>Provider workspace.</strong> Add and manage your storage facilities in this browser. Condition, capacity, fees, and availability are provider-entered and not independently verified.</p></div>

      <section className="provider-metrics" aria-label="Facility summary">
        <div><span>Registered facilities</span><strong>{facilities.length}</strong><small>Local provider records</small></div>
        <div><span>Available capacity</span><strong>{availableCapacity.toFixed(1)} t</strong><small>Converted to tonnes</small></div>
        <div><span>Accepting storage</span><strong>{availableCount}</strong><small>Provider-entered status</small></div>
        <div><span>Needs maintenance</span><strong>{needingMaintenance}</strong><small>Self-reported condition</small></div>
      </section>

      <section className="panel provider-form-panel" id="provider-facility-form">
        <div className="provider-section-heading">
          <div><span className="section-icon"><Warehouse size={20} /></span><div><h2>{editingFacility ? "Edit storage facility" : "Register a storage facility"}</h2><p>Changes appear in the farmer storage list immediately.</p></div></div>
          {editingFacility && <button type="button" className="button-quiet" onClick={startNew}><Plus size={15} />New facility</button>}
        </div>
        <form onSubmit={submitFacility} noValidate>
          <section className="provider-form-section">
            <h3>Facility information</h3>
            <div className="provider-field-grid">
              <Field label="Facility name *"><input required value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder="Example: East Bay Grain Store" /></Field>
              <Field label="Storage type"><select value={draft.type === "Warehouse" ? "General Warehouse" : draft.type} onChange={(event) => updateDraft("type", event.target.value)}>{storageTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
              <Field label="Total capacity *"><input type="number" min="0.1" step="0.1" value={draft.capacity || ""} onChange={(event) => updateDraft("capacity", Number(event.target.value))} /></Field>
              <Field label="Capacity unit"><select value={draft.capacityUnit} onChange={(event) => updateDraft("capacityUnit", event.target.value as Facility["capacityUnit"])}><option value="tonnes">Tonnes</option><option value="kilograms">Kilograms</option></select></Field>
              <Field label={`Occupied capacity (${draft.capacityUnit}) *`}><input type="number" min="0" step="0.1" value={draft.occupiedCapacity} onChange={(event) => updateDraft("occupiedCapacity", Number(event.target.value))} /><small>{available} {draft.capacityUnit} available by calculation</small></Field>
              <Field label="Availability"><select value={draft.availability} onChange={(event) => updateDraft("availability", event.target.value as Facility["availability"])}>{availabilityOptions.map((value) => <option key={value}>{value}</option>)}</select></Field>
            </div>
            <Field label="Description"><textarea rows={3} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} placeholder="Describe the storage space and services." /></Field>
            <fieldset className="provider-crops"><legend>Crops accepted *</legend>{crops.map((crop) => <label key={crop.name}><input type="checkbox" checked={draft.crops.includes(crop.name)} onChange={(event) => updateDraft("crops", event.target.checked ? [...draft.crops, crop.name] : draft.crops.filter((name) => name !== crop.name))} />{crop.name}</label>)}</fieldset>
          </section>

          <section className="provider-form-section">
            <h3>Location details</h3>
            <div className="provider-field-grid">
              <Field label="Country"><input value={draft.country} onChange={(event) => updateDraft("country", event.target.value)} /></Field>
              <Field label="State"><input value={draft.state} onChange={(event) => updateDraft("state", event.target.value)} /></Field>
              <Field label="District *"><input required value={draft.sampleDistrict} onChange={(event) => updateDraft("sampleDistrict", event.target.value)} placeholder="Enter district" /></Field>
              <Field label="Town or village *"><input required value={draft.locality} onChange={(event) => updateDraft("locality", event.target.value)} placeholder="Enter locality" /></Field>
              <Field label="Postal code"><input inputMode="numeric" value={draft.postalCode} onChange={(event) => updateDraft("postalCode", event.target.value)} /></Field>
              <Field label="Address description"><input value={draft.address} onChange={(event) => updateDraft("address", event.target.value)} /></Field>
              <Field label="Latitude (optional)"><input inputMode="decimal" value={draft.latitude} onChange={(event) => updateDraft("latitude", event.target.value)} /></Field>
              <Field label="Longitude (optional)"><input inputMode="decimal" value={draft.longitude} onChange={(event) => updateDraft("longitude", event.target.value)} /></Field>
            </div>
            <p className="provider-note">Locations are entered by the provider. FarmShield does not verify addresses or calculate real distances.</p>
          </section>

          <section className="provider-form-section">
            <h3>Condition and inspection</h3>
            <div className="provider-field-grid">
              <Field label="Overall condition"><select value={draft.condition} onChange={(event) => updateDraft("condition", event.target.value as Facility["condition"])}>{conditions.map((value) => <option key={value}>{value}</option>)}</select></Field>
              <Field label="Cleanliness"><select value={draft.cleanliness} onChange={(event) => updateDraft("cleanliness", event.target.value)}>{["Not entered", "Provider reports clean", "Provider reports needs attention"].map((value) => <option key={value}>{value}</option>)}</select></Field>
              <Field label="Ventilation"><select value={draft.ventilation} onChange={(event) => updateDraft("ventilation", event.target.value)}>{["Not entered", "Provider reports adequate", "Provider reports needs review"].map((value) => <option key={value}>{value}</option>)}</select></Field>
              <Field label="Moisture protection"><select value={draft.moistureProtection} onChange={(event) => updateDraft("moistureProtection", event.target.value)}>{["Not entered", "Provider reports protected", "Provider reports needs attention"].map((value) => <option key={value}>{value}</option>)}</select></Field>
              <Field label="Pest-control status"><select value={draft.pestControl} onChange={(event) => updateDraft("pestControl", event.target.value)}>{["Not entered", "Provider reports routine checks", "Provider reports needs review"].map((value) => <option key={value}>{value}</option>)}</select></Field>
              <Field label="Last inspection date"><input type="date" value={draft.inspectionDate} onChange={(event) => updateDraft("inspectionDate", event.target.value)} /></Field>
            </div>
            <Field label="Maintenance notes"><textarea rows={2} value={draft.maintenanceNotes} onChange={(event) => updateDraft("maintenanceNotes", event.target.value)} /></Field>
            <p className="provider-note"><Warning size={14} /> Condition and inspection details are self-reported and are not certified or independently verified.</p>
          </section>

          <section className="provider-form-section">
            <h3>Daily pricing and cost</h3>
            <div className="provider-field-grid">
              <Field label="Daily price (₹)"><input type="number" min="0" step="0.01" value={draft.dailyPrice || ""} onChange={(event) => updateDraft("dailyPrice", Number(event.target.value))} /></Field>
              <Field label="Pricing unit"><select value={draft.pricingUnit} onChange={(event) => updateDraft("pricingUnit", event.target.value as Facility["pricingUnit"])}><option>per tonne per day</option><option>per kilogram per day</option><option>per facility per day</option></select></Field>
              <Field label="Minimum duration (days)"><input type="number" min="1" step="1" value={draft.minimumDays} onChange={(event) => updateDraft("minimumDays", Number(event.target.value))} /></Field>
              <Field label="Handling fee (₹)"><input type="number" min="0" step="1" value={draft.handlingFee} onChange={(event) => updateDraft("handlingFee", Number(event.target.value))} /></Field>
              <Field label="Loading or unloading fee (₹)"><input type="number" min="0" step="1" value={draft.loadingFee} onChange={(event) => updateDraft("loadingFee", Number(event.target.value))} /></Field>
            </div>
            <Field label="Additional pricing notes"><textarea rows={2} value={draft.pricingNotes} onChange={(event) => updateDraft("pricingNotes", event.target.value)} /></Field>
            <div className="provider-calculator">
              <div><strong>Sample cost calculator</strong><span>Estimate only. No booking or charge is made.</span></div>
              <div className="provider-calculator-inputs">
                <Field label="Quantity"><input type="number" min="0" step="0.1" value={quantity} onChange={(event) => setQuantity(Math.max(0, Number(event.target.value)))} /></Field>
                <Field label="Quantity unit"><select value={quantityUnit} onChange={(event) => setQuantityUnit(event.target.value as typeof quantityUnit)}><option value="tonnes">Tonnes</option><option value="kilograms">Kilograms</option></select></Field>
                <Field label="Days"><input type="number" min="1" value={duration} onChange={(event) => setDuration(Math.max(1, Number(event.target.value)))} /></Field>
              </div>
              <div className="provider-calculator-total"><span>{draft.pricingUnit === "per facility per day" ? "Facility daily price × days" : `${quantity} ${quantityUnit} × daily price × ${duration} days`} plus entered fees</span><strong>{formatRupees(estimatedCost)}</strong></div>
            </div>
          </section>

          <section className="provider-form-section">
            <h3>Storage availability</h3>
            <div className="provider-availability-summary"><span>Total capacity <strong>{draft.capacity || 0} {draft.capacityUnit}</strong></span><span>Occupied <strong>{draft.occupiedCapacity} {draft.capacityUnit}</strong></span><span>Available <strong>{available} {draft.capacityUnit}</strong></span></div>
            <Field label="Availability notes"><textarea rows={2} value={draft.availabilityNotes} onChange={(event) => updateDraft("availabilityNotes", event.target.value)} /></Field>
          </section>

          {formError && <p className="provider-form-error" role="alert"><Warning size={15} />{formError}</p>}
          <div className="provider-form-actions"><p>Saving updates this local demo record. It does not publish verified listings.</p><button className="button-primary" type="submit"><FloppyDisk size={16} />{editingId ? "Save changes" : "Add facility"}</button></div>
        </form>
      </section>

      <section className="panel provider-management">
        <div className="provider-management-heading"><div><h2>Storage facility management</h2><p>Search and update the same records farmers can view.</p></div><button className="button-danger" onClick={requestReset}><Trash size={15} />Reset demo data</button></div>
        <div className="provider-filters">
          <Field label="Search facility or location"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, district, town" /></Field>
          <Field label="Storage type"><select value={filterType} onChange={(event) => setFilterType(event.target.value)}><option>All types</option>{storageTypes.map((value) => <option key={value}>{value === "General Warehouse" ? "Warehouse" : value}</option>)}</select></Field>
          <Field label="Condition"><select value={filterCondition} onChange={(event) => setFilterCondition(event.target.value)}><option>All conditions</option>{conditions.map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="Availability"><select value={filterAvailability} onChange={(event) => setFilterAvailability(event.target.value)}><option>All availability</option>{availabilityOptions.map((value) => <option key={value}>{value}</option>)}</select></Field>
        </div>
        <div className="provider-facility-list">
          {filteredFacilities.length ? filteredFacilities.map((facility) => {
            const free = Math.max(0, facility.capacity - facility.occupiedCapacity);
            const hasAlert = facility.devices.some((device) => device.enabled && device.status === "Online" &&
              ((device.temperature !== null && device.temperature > device.temperatureThreshold) ||
                (device.humidity !== null && device.humidity > device.humidityThreshold)));
            return <article className="provider-facility-row" key={facility.id}>
              <div className="provider-facility-main"><span className="facility-symbol"><Warehouse size={20} /></span><div><div className="provider-facility-title"><h3>{facility.name}</h3><span className={`provider-status condition-${facility.condition.toLowerCase().replaceAll(" ", "-")}`}>{facility.condition}</span><span className="sample-tag">Provider entry</span></div><p>{facility.locality}, {facility.sampleDistrict}, {facility.state}</p></div></div>
              <div className="provider-facility-stats"><span>Capacity<strong>{free} / {facility.capacity} {facility.capacityUnit} free</strong></span><span>Daily price<strong>{formatStorageRate(facility.dailyPrice)} / {facility.pricingUnit.replace(" per day", "/day")}</strong></span><span>Monitoring<strong>{facility.devices.length ? `${facility.devices.length} simulated device${facility.devices.length === 1 ? "" : "s"}${hasAlert ? ", alert" : ""}` : "Not configured"}</strong></span><span>Updated<strong>{facility.updatedAt}</strong></span></div>
              <div className="provider-facility-actions"><button className="button-quiet" onClick={() => onToggleAvailability(facility)} aria-label={`${facility.availability === "Unavailable" ? "Make available" : "Mark unavailable"}: ${facility.name}`}>{facility.availability === "Unavailable" ? "Mark available" : "Mark unavailable"}</button><button className="button-quiet" onClick={() => startEdit(facility)}><PencilSimple size={14} />Edit</button><button className="button-secondary" onClick={() => onPreview(facility)}>Preview on Farmer Dashboard<ArrowRight size={14} /></button><button className="button-quiet provider-delete" onClick={() => deleteFacility(facility)} aria-label={`Delete ${facility.name}`}><Trash size={14} />Delete</button></div>
            </article>;
          }) : <div className="provider-list-empty"><Warehouse size={22} /><strong>No facilities match these filters.</strong><button className="button-quiet" onClick={() => { setSearch(""); setFilterType("All types"); setFilterCondition("All conditions"); setFilterAvailability("All availability"); }}>Clear filters</button></div>}
        </div>
      </section>

      <div className="provider-footnote"><CheckCircle size={16} />Provider-entered fields and sample readings remain demonstration data. No connected devices, verified inspections, bookings, payments, or live inventory.</div>
    </div>
  );
}

export default StorageProviderPage;
