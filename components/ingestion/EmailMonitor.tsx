"use client";

import { useState, useEffect } from "react";

interface EmailRoute {
    workspace: string;
    metadata: Record<string, unknown>;
}

export default function EmailMonitor() {
    const [routes, setRoutes] = useState<EmailRoute[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchEmailRoutes = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/ingestion/email", {
                method: "POST",
            });
            if (!response.ok) {
                throw new Error("Failed to fetch email routes");
            }
            const data = await response.json();
            setRoutes(data);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 border rounded-lg shadow-sm bg-white">
            <h2 className="text-lg font-semibold mb-4">Email Ingestion Monitor</h2>
            <button
                onClick={fetchEmailRoutes}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
                {loading ? "Processing..." : "Poll Emails"}
            </button>
            {error && <p className="mt-2 text-red-600">{error}</p>}
            <div className="mt-4">
                {routes.length > 0 && (
                    <ul className="space-y-2">
                        {routes.map((route, index) => (
                            <li key={index} className="p-3 border rounded-md">
                                <p>
                                    <strong>Workspace:</strong> {route.workspace}
                                </p>
                                <pre className="text-sm text-gray-600 mt-1">
                                    {JSON.stringify(route.metadata, null, 2)}
                                </pre>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}