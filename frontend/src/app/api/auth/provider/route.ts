import { NextResponse } from "next/server";
import { ServerConfigurationError } from "@/lib/server/config";
import { ProviderAuthError, requireProvider } from "@/lib/server/providerAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { user } = await requireProvider(request);
    return NextResponse.json({
      success: true,
      provider: {
        id: user.id,
        email: user.email ?? null,
        role: "provider",
      },
    });
  } catch (error) {
    if (error instanceof ProviderAuthError) {
      return NextResponse.json(
        {
          success: false,
          error: error.status === 403
            ? "Unauthorized provider role."
            : "Your provider session is invalid or expired.",
          code: error.status === 403 ? "provider_role_required" : "invalid_provider_session",
        },
        { status: error.status },
      );
    }
    if (error instanceof ServerConfigurationError) {
      console.error(error.message);
      return NextResponse.json(
        { success: false, error: "Provider authentication is not configured.", code: "service_not_configured" },
        { status: 503 },
      );
    }
    console.error("Provider authorization check failed:", error);
    return NextResponse.json(
      { success: false, error: "Provider authorization could not be verified.", code: "provider_check_failed" },
      { status: 500 },
    );
  }
}