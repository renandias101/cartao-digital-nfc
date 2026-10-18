export type MfaFactorSummary = {
  id: string;
  factor_type: string;
  status: "verified" | "unverified";
};

export function classifyTotpFactors(factors: MfaFactorSummary[]) {
  const verified = factors.find((factor) => factor.factor_type === "totp" && factor.status === "verified");
  const unverifiedIds = factors
    .filter((factor) => factor.factor_type === "totp" && factor.status === "unverified")
    .map((factor) => factor.id);

  return { verifiedId: verified?.id ?? null, unverifiedIds };
}
