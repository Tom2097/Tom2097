"use client";

import { useState } from "react";

interface WhatsAppResult {
    text: string;
    intent?: string;
    entities?: Record<string, unknown>;
}

export default function WhatsAppMonitor() {
    const [result, setResult] = useState<WhatsAppResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const simulateWhatsAppMessage = async () => {
        setLoading(true);
        setError(null);
        try {
            const mockMessage = {
                from: "+1234567890",
                voiceNote: {
                    url: "https://example.com/voice-note.ogg",
                    mimetype: "audio/ogg",
                },
            };
            const response = await fetch("/api/ingestion/whatsapp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(mockMessage),
            });
            if (!response.ok) {
                throw new Error("Failed to process WhatsApp message");
            }
            const data = await response.json();
            setResult(data);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 border rounded-lg shadow-sm bg-white">
            <h2 className="text-lg font-semibold mb-4">WhatsApp Ingestion Monitor</h2>
            <button
                onClick={simulateWhatsAppMessage}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
                {loading ? "Processing..." : "Simulate WhatsApp Message"}
            </button>
            {error && <p className="mt-2 text-red-600">{error}</p>}
            {result && (
                <div className="mt-4 p-3 border rounded-md">
                    <p>
                        <strong>Transcription:</strong> {result.text}
                    </p>
                    {result.intent && (
                        <p>
                            <strong>Intent:</strong> {result.intent}
                        </p>
                    )}
                    {result.entities && (
                        <pre className="text-sm text-gray-600 mt-1">
                            {JSON.stringify(result.entities, null, 2)}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
}