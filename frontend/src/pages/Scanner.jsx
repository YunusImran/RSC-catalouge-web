import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { api, apiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import { ScanLine, Camera, StopCircle, AlertTriangle, X, Send, Trash2 } from "lucide-react";

const MOBILE_RE = /^[+]?[0-9\-\s()]{7,20}$/;

export default function Scanner() {
    const navigate = useNavigate();
    const [code, setCode] = useState("");
    const [action, setAction] = useState("Search");
    const [cameraOn, setCameraOn] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const [cameras, setCameras] = useState([]);
    const [selectedCameraId, setSelectedCameraId] = useState("");
    const scannerRef = useRef(null);
    const inputRef = useRef(null);

    // BATCH ISSUE state
    const [employees, setEmployees] = useState([]);
    const [basket, setBasket] = useState([]);  // [{id, catalog_code, catalog_name}]
    const [customer, setCustomer] = useState({
        customer_name: "", employee_id: "", department: "",
        mobile: "", email: "",
        issue_date: new Date().toISOString().slice(0, 10),
        expected_return_date: "", remarks: ""
    });

    useEffect(() => {
        inputRef.current?.focus();
        api.get("/employees", { params: { active_only: true } }).then(({ data }) => setEmployees(data));
    }, []);

    const probeCameras = async () => {
        try {
            const list = await Html5Qrcode.getCameras();
            setCameras(list || []);
            if (list?.length) {
                const rear = list.find((c) => /back|rear|environment/i.test(c.label)) || list[list.length - 1];
                setSelectedCameraId(rear.id);
            }
            return list;
        } catch (e) { return null; }
    };

    const addToBasket = async (value) => {
        if (!value) return;
        if (action !== "Issue") {
            // Default behavior — search/view/return = open the catalog
            try {
                const { data } = await api.post("/scans", { barcode_value: value, action, device_type: cameraOn ? "Camera" : "USB/Manual" });
                toast.success(`Found: ${data.catalog.catalog_name}`);
                navigate(`/catalogs/${data.catalog.id}`);
            } catch (e) { toast.error(apiError(e)); }
            return;
        }
        // ISSUE action — add to batch basket
        if (basket.some((b) => b.id === value || b.catalog_code === value || b.qr_value === value)) {
            toast.info("Already in basket");
            return;
        }
        try {
            const { data } = await api.post("/scans", { barcode_value: value, action: "Search", device_type: cameraOn ? "Camera" : "USB/Manual" });
            const cat = data.catalog;
            if (cat.status === "Issued") {
                toast.error(`${cat.catalog_code} is already issued`);
                return;
            }
            setBasket((b) => [...b, { id: cat.id, catalog_code: cat.catalog_code, catalog_name: cat.catalog_name, cat_no: cat.cat_no || "" }]);
            toast.success(`+ ${cat.catalog_name}`);
        } catch (e) { toast.error(apiError(e)); }
    };

    const removeFromBasket = (id) => setBasket((b) => b.filter((x) => x.id !== id));
    const clearBasket = () => setBasket([]);

    const submitBatch = async (e) => {
        e.preventDefault();
        if (basket.length === 0) { toast.error("Basket is empty"); return; }
        if (!MOBILE_RE.test(customer.mobile.trim())) {
            toast.error("Valid mobile number required (7-20 digits, +/-/() allowed)");
            return;
        }
        if (!customer.expected_return_date) {
            toast.error("Due date is required"); return;
        }
        try {
            const emp = employees.find((x) => x.id === customer.employee_id);
            const { data } = await api.post("/issues/batch", {
                ...customer,
                catalog_ids: basket.map((b) => b.id),
                employee_name: emp ? emp.name : "",
                department: customer.department || (emp ? emp.department : "") || "",
            });
            toast.success(`Issued ${data.count} catalog(s) under ${data.transaction_id}`);
            setBasket([]);
            navigate(`/issues-returns`);
        } catch (e) { toast.error(apiError(e)); }
    };

    const startCamera = async () => {
        setCameraError("");
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            const msg = "This browser/device doesn't support camera access.";
            setCameraError(msg); toast.error(msg); return;
        }
        if (!window.isSecureContext) {
            const msg = "Camera requires HTTPS."; setCameraError(msg); toast.error(msg); return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
            stream.getTracks().forEach((t) => t.stop());
        } catch (permErr) {
            const map = {
                NotAllowedError: "Camera permission denied. Allow it from the address bar lock icon.",
                NotFoundError: "No camera detected on this device.",
                NotReadableError: "Camera is already in use by another app.",
            };
            const msg = map[permErr.name] || `Camera error: ${permErr.message || permErr.name}`;
            setCameraError(msg); toast.error(msg); return;
        }
        const list = await probeCameras();
        try {
            const html5 = new Html5Qrcode("camera-region", { verbose: false });
            scannerRef.current = html5;
            const camConfig = selectedCameraId || (list && list[0]?.id) || { facingMode: { ideal: "environment" } };
            await html5.start(
                camConfig,
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decoded) => {
                    addToBasket(decoded);
                    if (action !== "Issue") stopCamera(); // for non-issue, stop after one scan
                },
                () => {}
            );
            setCameraOn(true);
        } catch (e) {
            const msg = `Cannot start camera: ${e?.message || e}`;
            setCameraError(msg); toast.error(msg);
        }
    };

    const stopCamera = async () => {
        try {
            if (scannerRef.current) {
                const state = scannerRef.current.getState && scannerRef.current.getState();
                if (state === 2 || state === 3) await scannerRef.current.stop();
                try { scannerRef.current.clear(); } catch (_) {}
            }
        } catch (_) {}
        const region = document.getElementById("camera-region");
        if (region) { while (region.firstChild) { try { region.removeChild(region.firstChild); } catch (_) { break; } } }
        scannerRef.current = null;
        setCameraOn(false);
    };

    useEffect(() => () => { stopCamera(); /* eslint-disable-next-line */ }, []);

    const onManualSubmit = (e) => {
        e.preventDefault();
        const v = code.trim();
        setCode("");
        if (v) addToBasket(v);
        // refocus for the next scan
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const isIssueMode = action === "Issue";

    return (
        <div>
            <PageHeader title="Barcode Scanner" subtitle="Scan · Catalogs" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Scan side */}
                <Card className="p-8 surface-card rounded-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <ScanLine className="w-6 h-6 text-accent" />
                        <h3 className="font-display font-bold text-xl">USB Scanner / Manual</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                        Set the action below. <b>Issue</b> mode lets you scan multiple barcodes one after another — they all share the same transaction ID when issued to the same customer.
                    </p>
                    <form onSubmit={onManualSubmit} className="space-y-4">
                        <div>
                            <Label className="label-uppercase">Barcode / Catalog Code</Label>
                            <Input ref={inputRef} autoFocus value={code} onChange={(e) => setCode(e.target.value)}
                                placeholder="Scan or type code…" className="font-mono text-lg"
                                data-testid="scanner-input" />
                        </div>
                        <div>
                            <Label className="label-uppercase">Action</Label>
                            <Select value={action} onValueChange={(v) => { setAction(v); if (v !== "Issue") setBasket([]); }}>
                                <SelectTrigger data-testid="scanner-action-select"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Search">Search</SelectItem>
                                    <SelectItem value="View">View</SelectItem>
                                    <SelectItem value="Issue">Issue (batch — same customer, same Txn ID)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="submit" className="w-full" data-testid="scanner-submit-btn">
                            {isIssueMode ? "Add to Basket" : "Scan"}
                        </Button>
                    </form>

                    {/* Camera */}
                    <div className="mt-8 border-t border-border pt-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Camera className="w-5 h-5 text-accent" />
                            <h4 className="font-display font-bold text-lg">Camera Scanner</h4>
                        </div>
                        {cameras.length > 1 && (
                            <div className="mb-3">
                                <Label className="label-uppercase">Camera</Label>
                                <Select value={selectedCameraId} onValueChange={setSelectedCameraId}>
                                    <SelectTrigger data-testid="camera-select"><SelectValue placeholder="Select camera" /></SelectTrigger>
                                    <SelectContent>
                                        {cameras.map((c) => <SelectItem key={c.id} value={c.id}>{c.label || c.id}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="relative w-full bg-muted rounded-sm overflow-hidden mb-3 aspect-video">
                            <div id="camera-region" className="absolute inset-0" />
                            {!cameraOn && (
                                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                                    <span className="text-xs text-muted-foreground">Camera off</span>
                                </div>
                            )}
                        </div>
                        {cameraError && (
                            <div className="mb-3 flex items-start gap-2 p-3 border border-destructive/40 bg-destructive/5 rounded-sm text-xs text-destructive"
                                 data-testid="camera-error">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{cameraError}</span>
                            </div>
                        )}
                        {cameraOn ?
                            <Button variant="destructive" onClick={stopCamera} className="w-full" data-testid="camera-stop-btn">
                                <StopCircle className="w-4 h-4 mr-2" /> Stop Camera
                            </Button> :
                            <Button onClick={startCamera} className="w-full" data-testid="camera-start-btn">
                                <Camera className="w-4 h-4 mr-2" /> Start Camera
                            </Button>}
                    </div>
                </Card>

                {/* Right side: Basket + customer form (only when Issue mode) */}
                {isIssueMode ? (
                    <Card className="p-8 surface-card rounded-sm" data-testid="batch-issue-card">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-display font-bold text-xl">Batch Issue</h3>
                            <span className="px-2 py-0.5 text-xs font-mono rounded-sm bg-primary/15 text-primary" data-testid="basket-count">
                                {basket.length} item{basket.length !== 1 ? "s" : ""}
                            </span>
                        </div>
                        <div className="border border-dashed border-border rounded-sm max-h-52 overflow-y-auto p-2 mb-4" data-testid="basket">
                            {basket.length === 0 ?
                                <div className="text-xs text-muted-foreground text-center py-8">
                                    Scan or type catalog codes — they appear here.
                                </div> :
                                basket.map((b) => (
                                    <div key={b.id} className="flex items-center justify-between gap-2 py-1.5 px-2 border-b last:border-0 border-border text-sm">
                                        <div className="min-w-0">
                                            <div className="font-medium truncate">{b.catalog_name}</div>
                                            <div className="font-mono text-[10px] text-muted-foreground">{b.catalog_code} {b.cat_no ? `· ${b.cat_no}` : ""}</div>
                                        </div>
                                        <Button size="sm" variant="ghost" onClick={() => removeFromBasket(b.id)} data-testid={`remove-${b.catalog_code}`}>
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))
                            }
                        </div>
                        {basket.length > 0 && (
                            <Button size="sm" variant="outline" onClick={clearBasket} className="mb-4" data-testid="clear-basket-btn">
                                <Trash2 className="w-3 h-3 mr-2" /> Clear basket
                            </Button>
                        )}

                        <form onSubmit={submitBatch} className="space-y-3" data-testid="batch-issue-form">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="label-uppercase">Customer Name</Label>
                                    <Input value={customer.customer_name}
                                           onChange={(e) => setCustomer({ ...customer, customer_name: e.target.value })}
                                           data-testid="batch-customer-input" />
                                </div>
                                <div>
                                    <Label className="label-uppercase">Mobile *</Label>
                                    <Input required value={customer.mobile}
                                           onChange={(e) => setCustomer({ ...customer, mobile: e.target.value })}
                                           placeholder="+971 55 …" data-testid="batch-mobile-input" />
                                </div>
                            </div>
                            <div>
                                <Label className="label-uppercase">Employee</Label>
                                <Select value={customer.employee_id || "none"} onValueChange={(v) => setCustomer({ ...customer, employee_id: v === "none" ? "" : v })}>
                                    <SelectTrigger data-testid="batch-employee-select"><SelectValue placeholder="Select employee" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">— None —</SelectItem>
                                        {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="label-uppercase">Issue Date</Label>
                                    <Input type="date" value={customer.issue_date}
                                           onChange={(e) => setCustomer({ ...customer, issue_date: e.target.value })} />
                                </div>
                                <div>
                                    <Label className="label-uppercase">Due Date *</Label>
                                    <Input required type="date" value={customer.expected_return_date}
                                           onChange={(e) => setCustomer({ ...customer, expected_return_date: e.target.value })}
                                           data-testid="batch-due-date-input" />
                                </div>
                            </div>
                            <div>
                                <Label className="label-uppercase">Remarks</Label>
                                <Textarea rows={2} value={customer.remarks}
                                          onChange={(e) => setCustomer({ ...customer, remarks: e.target.value })} />
                            </div>
                            <Button type="submit" className="w-full" disabled={basket.length === 0} data-testid="submit-batch-btn">
                                <Send className="w-4 h-4 mr-2" /> Issue {basket.length} catalog{basket.length !== 1 ? "s" : ""} (one Txn ID)
                            </Button>
                        </form>
                    </Card>
                ) : (
                    <Card className="p-8 surface-card rounded-sm bg-muted/20 border-dashed">
                        <div className="text-center text-muted-foreground space-y-2">
                            <ScanLine className="w-10 h-10 mx-auto opacity-50" />
                            <div className="font-display font-bold text-lg">Quick scan mode</div>
                            <p className="text-sm">In Search/View mode, scanning opens the catalog directly.</p>
                            <p className="text-xs">Switch action to <b>Issue</b> to scan multiple catalogs to the same customer with one shared Txn ID.</p>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
