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
import { ScanLine, Camera, StopCircle } from "lucide-react";

export default function Scanner() {
    const navigate = useNavigate();
    const [code, setCode] = useState("");
    const [action, setAction] = useState("Search");
    const [cameraOn, setCameraOn] = useState(false);
    const scannerRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleScan = async (value) => {
        if (!value) return;
        try {
            const { data } = await api.post("/scans", { barcode_value: value, action, device_type: cameraOn ? "Camera" : "USB/Manual" });
            toast.success(`Found: ${data.catalog.catalog_name}`);
            navigate(`/catalogs/${data.catalog.id}`);
        } catch (e) { toast.error(apiError(e)); }
    };

    const startCamera = async () => {
        try {
            const html5 = new Html5Qrcode("camera-region");
            scannerRef.current = html5;
            await html5.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: 250 },
                (decoded) => {
                    handleScan(decoded);
                    stopCamera();
                },
                () => {}
            );
            setCameraOn(true);
        } catch (e) {
            toast.error("Cannot access camera: " + e.message);
        }
    };
    const stopCamera = async () => {
        try { await scannerRef.current?.stop(); await scannerRef.current?.clear(); } catch (_) {}
        scannerRef.current = null;
        setCameraOn(false);
    };
    useEffect(() => () => { stopCamera(); }, []);

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
                    </p>
                    <div id="camera-region" className="w-full bg-muted rounded-sm overflow-hidden mb-4 aspect-video grid place-items-center">
                        {!cameraOn && <span className="text-xs text-muted-foreground">Camera off</span>}
                    </div>
                    {cameraOn ?
                        <Button variant="destructive" onClick={stopCamera} className="w-full" data-testid="camera-stop-btn">
                            <StopCircle className="w-4 h-4 mr-2" /> Stop Camera
                        </Button> :
                        <Button onClick={startCamera} className="w-full" data-testid="camera-start-btn">
                            <Camera className="w-4 h-4 mr-2" /> Start Camera
                        </Button>}
                </Card>
            </div>
        </div>
    );
}
