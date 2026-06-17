import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { api, apiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import { ScanLine, Camera, StopCircle, AlertTriangle } from "lucide-react";

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

    useEffect(() => { inputRef.current?.focus(); }, []);

    // Probe cameras once at mount (won't trigger permission prompt by itself on most browsers,
    // but if it does we want to show real labels)
    const probeCameras = async () => {
        try {
            const list = await Html5Qrcode.getCameras();
            setCameras(list || []);
            if (list?.length) {
                // prefer rear/environment camera
                const rear = list.find((c) => /back|rear|environment/i.test(c.label)) || list[list.length - 1];
                setSelectedCameraId(rear.id);
            }
            return list;
        } catch (e) {
            return null;
        }
    };

    const handleScan = async (value) => {
        if (!value) return;
        try {
            const { data } = await api.post("/scans", {
                barcode_value: value, action,
                device_type: cameraOn ? "Camera" : "USB/Manual",
            });
            toast.success(`Found: ${data.catalog.catalog_name}`);
            navigate(`/catalogs/${data.catalog.id}`);
        } catch (e) { toast.error(apiError(e)); }
    };

    const startCamera = async () => {
        setCameraError("");

        // 1) Browser support check
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            const msg = "This browser/device doesn't support camera access. Use a USB scanner or type the code manually.";
            setCameraError(msg); toast.error(msg);
            return;
        }
        if (!window.isSecureContext) {
            const msg = "Camera requires HTTPS. Open this page over https:// (the preview URL is fine).";
            setCameraError(msg); toast.error(msg);
            return;
        }

        // 2) Ask permission explicitly so we get a clear error
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: "environment" } },
                audio: false,
            });
            // We don't need the stream object — html5-qrcode will open its own
            stream.getTracks().forEach((t) => t.stop());
        } catch (permErr) {
            const map = {
                NotAllowedError: "Camera permission was denied. Click the lock icon in the address bar and Allow camera.",
                NotFoundError: "No camera detected on this device.",
                NotReadableError: "Camera is already in use by another app. Close it and retry.",
                OverconstrainedError: "No camera matches the requested settings.",
                SecurityError: "Camera blocked by browser security settings.",
            };
            const msg = map[permErr.name] || `Camera error: ${permErr.message || permErr.name}`;
            setCameraError(msg); toast.error(msg);
            return;
        }

        // 3) Now enumerate cameras and start
        const list = await probeCameras();
        try {
            const html5 = new Html5Qrcode("camera-region", { verbose: false });
            scannerRef.current = html5;
            const camConfig = selectedCameraId || (list && list[0]?.id) ||
                              { facingMode: { ideal: "environment" } };
            await html5.start(
                camConfig,
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decoded) => { handleScan(decoded); stopCamera(); },
                () => {} // ignore decode-fail callbacks (called continuously while looking)
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
                const isScanning = scannerRef.current.getState && scannerRef.current.getState() === 2;
                if (isScanning) await scannerRef.current.stop();
                await scannerRef.current.clear();
            }
        } catch (_) {}
        scannerRef.current = null;
        setCameraOn(false);
    };

    useEffect(() => () => { stopCamera(); /* eslint-disable-next-line */ }, []);

    const onManualSubmit = (e) => {
        e.preventDefault();
        const v = code.trim();
        setCode("");
        if (v) handleScan(v);
    };

    return (
        <div>
            <PageHeader title="Barcode Scanner" subtitle="Scan · Catalogs" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-8 surface-card rounded-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <ScanLine className="w-6 h-6 text-accent" />
                        <h3 className="font-display font-bold text-xl">USB Scanner / Manual</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                        Most USB barcode scanners act as keyboards. Click the input and scan — it auto-submits on Enter.
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
                            <Select value={action} onValueChange={setAction}>
                                <SelectTrigger data-testid="scanner-action-select"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Search">Search</SelectItem>
                                    <SelectItem value="View">View</SelectItem>
                                    <SelectItem value="Issue">Issue</SelectItem>
                                    <SelectItem value="Return">Return</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="submit" className="w-full" data-testid="scanner-submit-btn">Scan</Button>
                    </form>
                </Card>

                <Card className="p-8 surface-card rounded-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <Camera className="w-6 h-6 text-accent" />
                        <h3 className="font-display font-bold text-xl">Camera Scanner</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                        Use your device camera to scan QR codes printed on catalogs.
                        On phones, grant permission when prompted.
                    </p>

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

                    <div id="camera-region"
                         className="w-full bg-muted rounded-sm overflow-hidden mb-4 aspect-video grid place-items-center">
                        {!cameraOn && <span className="text-xs text-muted-foreground">Camera off</span>}
                    </div>

                    {cameraError && (
                        <div className="mb-3 flex items-start gap-2 p-3 border border-destructive/40 bg-destructive/5 rounded-sm text-xs text-destructive"
                             data-testid="camera-error">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{cameraError}</span>
                        </div>
                    )}

                    {cameraOn ?
                        <Button variant="destructive" onClick={stopCamera} className="w-full" data-testid="camera-stop-btn">
                            <StopCircle className="w-4 h-4 mr-2" /> Stop Camera
                        </Button> :
                        <Button onClick={startCamera} className="w-full" data-testid="camera-start-btn">
                            <Camera className="w-4 h-4 mr-2" /> Start Camera
                        </Button>}

                    <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
                        Tip: if the camera fails on desktop, open this page on your phone instead — phones have a rear camera that
                        reads QR codes more reliably. Or use a USB scanner with the input on the left.
                    </p>
                </Card>
            </div>
        </div>
    );
}
