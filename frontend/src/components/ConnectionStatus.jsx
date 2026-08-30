import React from "react";

export const Dot = ({ ok = true, className = "" }) => (
  <span
    className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${className}`}
    style={{ background: ok ? "#16A34A" : "#DC2626" }}
  />
);

export const StatusLine = ({ label, ok, okText = "Connected", badText = "Offline", testId }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-[#F0F0F0] last:border-0" data-testid={testId}>
    <span className="text-sm font-medium text-[#2C2C2C]">{label}</span>
    <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: ok ? "#16A34A" : "#DC2626" }}>
      <Dot ok={ok} />
      {ok ? okText : badText}
    </span>
  </div>
);

export const ConnectionStatus = ({ connection, posConnected = false, testId = "connection-status" }) => (
  <div className="bg-white border border-[#E5E7EB] rounded-md p-4" data-testid={testId}>
    <div className="text-xs font-bold tracking-widest uppercase opacity-55 mb-1">Connection Status</div>
    <StatusLine label="Server" ok={connection.serverConnected} testId="status-server" />
    <StatusLine label="POS" ok={posConnected} testId="status-pos" />
    <StatusLine
      label="Real-time Sync"
      ok={connection.serverConnected && posConnected}
      okText="Active"
      badText="Local"
      testId="status-sync"
    />
  </div>
);
