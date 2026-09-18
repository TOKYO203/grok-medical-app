import { useEffect } from "react";
import { isLicenseReceipt } from "@/content/license-receipt";
import type { LicenseReceipt } from "@/core/types";
import { useOptimus } from "@/state/store";

type LicenseStatus = {
  active?: boolean;
  revoked?: boolean;
  expired?: boolean;
};

async function isRevoked(receipt: LicenseReceipt): Promise<boolean> {
  try {
    const response = await fetch("/api/licenses/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receipt }),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as LicenseStatus;
    return result.revoked === true;
  } catch {
    return false;
  }
}

async function refreshLicenseRevocations() {
  const state = useOptimus.getState();
  const receipts = state.licenseReceipts.filter(isLicenseReceipt);
  if (receipts.length === 0) return;

  const revoked = new Set<string>();
  await Promise.all(
    receipts.map(async (receipt) => {
      if (await isRevoked(receipt)) revoked.add(receipt.signature.value);
    }),
  );
  if (revoked.size === 0) return;

  useOptimus.setState((current) => ({
    licenseReceipts: current.licenseReceipts.filter(
      (receipt) => !revoked.has(receipt.signature.value),
    ),
  }));
  await useOptimus.getState().restoreLicenses();
}

export function LicenseRevocationBridge() {
  const hydrated = useOptimus((state) => state.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    const refresh = () => {
      if (navigator.onLine) void refreshLicenseRevocations();
    };
    refresh();
    window.addEventListener("online", refresh);
    return () => window.removeEventListener("online", refresh);
  }, [hydrated]);
  return null;
}
