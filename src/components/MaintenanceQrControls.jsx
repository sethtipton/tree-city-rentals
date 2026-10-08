import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Printer, QrCode, RefreshCw, ShieldOff } from "lucide-react";
import {
  disableUnitMaintenanceQr,
  generateUnitMaintenanceQr,
  getMaintenanceQrUrl,
  isMaintenanceQrToken,
} from "../lib/maintenanceQr";

export function MaintenanceQrControls({ property, selectedUnit, propertyUnits }) {
  const generateDialogRef = useRef(null);
  const disableDialogRef = useRef(null);
  const [temporaryTokens, setTemporaryTokens] = useState({});
  const [statusOverrides, setStatusOverrides] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [printUnits, setPrintUnits] = useState([]);

  const unit = selectedUnit
    ? { ...selectedUnit, maintenance_access_enabled: statusOverrides[selectedUnit.id] ?? selectedUnit.maintenance_access_enabled }
    : null;
  const temporaryUnitCards = useMemo(() => propertyUnits
    .filter((propertyUnit) => isMaintenanceQrToken(temporaryTokens[propertyUnit.id]))
    .map((propertyUnit) => ({ ...propertyUnit, maintenanceAccessToken: temporaryTokens[propertyUnit.id] })), [propertyUnits, temporaryTokens]);
  const hasTemporaryCode = isMaintenanceQrToken(temporaryTokens[unit?.id]);
  const codeIsActive = Boolean(unit?.maintenance_access_enabled);

  useEffect(() => {
    if (printUnits.length === 0) return undefined;
    const originalTitle = document.title;
    document.title = `Tree City Rentals - ${property.name} - ${printUnits.length === 1 ? printUnits[0].name : "Maintenance QR cards"}`;
    const frame = window.requestAnimationFrame(() => window.print());
    const clearPrintSheet = () => setPrintUnits([]);
    window.addEventListener("afterprint", clearPrintSheet, { once: true });
    return () => {
      document.title = originalTitle;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", clearPrintSheet);
    };
  }, [printUnits, property.name]);

  async function copyUnitUrl() {
    const token = temporaryTokens[unit?.id];
    if (!unit || !isMaintenanceQrToken(token)) return;
    try {
      await navigator.clipboard.writeText(getMaintenanceQrUrl(token));
      setMessage("Maintenance link copied.");
    } catch {
      setMessage("We couldn’t copy the link. Select it from the QR card instead.");
    }
  }

  async function generate() {
    if (!unit) return;
    setBusy(true);
    setMessage("");
    try {
      const token = await generateUnitMaintenanceQr(unit.id);
      setTemporaryTokens((current) => ({ ...current, [unit.id]: token }));
      setStatusOverrides((current) => ({ ...current, [unit.id]: true }));
      setMessage(codeIsActive
        ? "A replacement QR code is ready. All earlier printed cards stopped working immediately."
        : "A maintenance QR code is ready. Save a PDF before leaving this page, then print and post the card.");
      generateDialogRef.current?.close();
    } catch (error) {
      setMessage(error.message || "We couldn’t generate this QR code.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!unit) return;
    setBusy(true);
    setMessage("");
    try {
      await disableUnitMaintenanceQr(unit.id);
      setStatusOverrides((current) => ({ ...current, [unit.id]: false }));
      setTemporaryTokens((current) => {
        const next = { ...current };
        delete next[unit.id];
        return next;
      });
      setMessage("Maintenance QR access is disabled. The printed code no longer accepts requests.");
      disableDialogRef.current?.close();
    } catch (error) {
      setMessage(error.message || "We couldn’t disable this QR code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="maintenance-qr-controls" aria-labelledby="maintenance-qr-controls-title">
      <div className="maintenance-qr-controls-heading">
        <div>
          <p className="eyebrow">Unit access</p>
          <h3 id="maintenance-qr-controls-title"><QrCode size={20} aria-hidden="true" /> Maintenance QR codes</h3>
          <p>A QR grants only the ability to submit one new maintenance request for its unit. Codes are 256-bit secrets, stored only as hashes, and their full link is shown here only when newly generated.</p>
        </div>
        {temporaryUnitCards.length > 0 && <button className="ghost" type="button" onClick={() => setPrintUnits(temporaryUnitCards)}><Printer size={17} aria-hidden="true" /> Save PDF or print all cards</button>}
      </div>

      {unit ? (
        <div className="maintenance-qr-unit-layout">
          {hasTemporaryCode ? <QrUnitCard property={property} unit={{ ...unit, maintenanceAccessToken: temporaryTokens[unit.id] }} /> : (
            <div className="maintenance-qr-card maintenance-qr-card-status">
              <p className="maintenance-qr-brand">Tree City Rentals</p>
              <h4>{property.name}</h4>
              <p className="maintenance-qr-unit-name">Unit {unit.name}</p>
              <p>{codeIsActive ? "QR access is active. To reprint the same code, open your saved PDF and print it. If you have no saved copy, rotate the code to create a replacement; every old card will stop working." : "QR access is disabled. Generate a new card to enable maintenance intake."}</p>
            </div>
          )}
          <div className="maintenance-qr-actions">
            <p><strong>{property.name} · {unit.name}</strong></p>
            {hasTemporaryCode && <p className="maintenance-qr-url"><code>{getMaintenanceQrUrl(temporaryTokens[unit.id])}</code></p>}
            {hasTemporaryCode && <button type="button" onClick={copyUnitUrl}><Copy size={17} aria-hidden="true" /> Copy link</button>}
            {hasTemporaryCode && <div className="maintenance-qr-save-guide">
              <strong>Keep a copy for easy reprinting</strong>
              <p>Save this card before leaving this page. Its QR code cannot be retrieved later.</p>
              <button type="button" onClick={() => setPrintUnits([{ ...unit, maintenanceAccessToken: temporaryTokens[unit.id] }])}><Printer size={17} aria-hidden="true" /> Save PDF or print this card</button>
              <ol>
                <li>In the print window, choose <strong>Save as PDF</strong> in Chrome, or <strong>PDF → Save as PDF</strong> in the Mac print dialog.</li>
                <li>Save the file with the property and unit name, then print it at 100% scale.</li>
                <li>Scan the printed card with your phone before posting it.</li>
              </ol>
              <p>To print more copies later, open that PDF. Saving or printing does not change the code.</p>
            </div>}
            <button className="ghost maintenance-qr-regenerate" type="button" onClick={() => generateDialogRef.current?.showModal()}><RefreshCw size={17} aria-hidden="true" /> {codeIsActive ? "Rotate QR code" : "Generate QR code"}</button>
            {codeIsActive && <button className="ghost danger-button" type="button" onClick={() => disableDialogRef.current?.showModal()}><ShieldOff size={17} aria-hidden="true" /> Disable QR access</button>}
            <p className="maintenance-qr-note">{codeIsActive ? "Rotating or disabling immediately invalidates every previously printed card." : "Generating a replacement creates a new code; an old disabled code is never re-enabled."}</p>
          </div>
        </div>
      ) : temporaryUnitCards.length > 0 ? (
        <div className="maintenance-qr-card-list" aria-label={`${property.name} newly generated maintenance QR codes`}>
          {temporaryUnitCards.map((propertyUnit) => <QrUnitCard key={propertyUnit.id} property={property} unit={propertyUnit} />)}
        </div>
      ) : <p className="maintenance-qr-note">Select a unit to generate, rotate, or disable its maintenance QR code.</p>}

      {message && <p className="message" role="status">{message}</p>}

      <dialog ref={generateDialogRef} className="maintenance-qr-dialog" aria-labelledby="maintenance-qr-generate-title">
        <form method="dialog" onSubmit={(event) => { event.preventDefault(); generate(); }}>
          <p className="eyebrow">{codeIsActive ? "Replace QR code" : "Create QR code"}</p>
          <h2 id="maintenance-qr-generate-title">{codeIsActive ? `Rotate ${unit?.name}’s maintenance QR code?` : `Generate a maintenance QR code for ${unit?.name}?`}</h2>
          <p>{codeIsActive ? "The existing printed code will stop working immediately. Save a PDF, print and post the replacement before discarding the old card." : "The new code will be shown on this page so you can save a PDF and print the card. It cannot be retrieved after you leave."}</p>
          <div>
            <button className="ghost" type="button" onClick={() => generateDialogRef.current?.close()}>Cancel</button>
            <button type="submit" disabled={busy}>{busy ? "Generating…" : codeIsActive ? "Rotate QR code" : "Generate QR code"}</button>
          </div>
        </form>
      </dialog>

      <dialog ref={disableDialogRef} className="maintenance-qr-dialog" aria-labelledby="maintenance-qr-disable-title">
        <form method="dialog" onSubmit={(event) => { event.preventDefault(); disable(); }}>
          <p className="eyebrow">Disable QR access</p>
          <h2 id="maintenance-qr-disable-title">Disable maintenance intake for {unit?.name}?</h2>
          <p>All existing QR cards for this unit will stop working immediately. Re-enable intake by generating a new QR code.</p>
          <div>
            <button className="ghost" type="button" onClick={() => disableDialogRef.current?.close()}>Cancel</button>
            <button className="danger-button" type="submit" disabled={busy}>{busy ? "Disabling…" : "Disable QR access"}</button>
          </div>
        </form>
      </dialog>

      {printUnits.length > 0 && <section className="maintenance-qr-print-sheet" aria-hidden="true">{printUnits.map((printUnit) => <QrUnitCard key={printUnit.id} property={property} unit={printUnit} printable />)}</section>}
    </section>
  );
}

function QrUnitCard({ property, unit, printable = false }) {
  const url = getMaintenanceQrUrl(unit.maintenanceAccessToken);
  return (
    <article className={printable ? "maintenance-qr-card printable" : "maintenance-qr-card"}>
      <p className="maintenance-qr-brand">Tree City Rentals</p>
      <h4>{property.name}</h4>
      <p className="maintenance-qr-unit-name">Unit {unit.name}</p>
      <QRCodeSVG value={url} size={printable ? 204 : 172} level="M" marginSize={4} bgColor="#ffffff" fgColor="#122319" title={`Maintenance request QR code for ${property.name}, unit ${unit.name}`} />
      <p className="maintenance-qr-instruction">Scan to submit a maintenance request</p>
      <p className="maintenance-qr-path">{url}</p>
    </article>
  );
}
