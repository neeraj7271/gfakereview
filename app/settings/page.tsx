import { Settings } from "lucide-react";
import { getDefaultProfile } from "@/lib/profile";
import SettingsForm from "@/components/SettingsForm";
import GoogleConnectionPanel from "@/components/GoogleConnectionPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getDefaultProfile();

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-kicker">Configure the business profile, detection sensitivity, and Google integration state.</p>
        </div>
      </header>
      <section className="grid grid-2">
        <div className="panel">
          <div className="panel-body">
            <h2 className="section-title">
              <Settings size={18} aria-hidden="true" /> Business profile
            </h2>
            <SettingsForm
              profile={{
                name: profile.name,
                googleLocationName: profile.googleLocationName,
                industry: profile.industry,
                websiteUrl: profile.websiteUrl,
                phone: profile.phone,
                address: profile.address,
                reviewUrl: profile.reviewUrl,
                detectionSensitivity: profile.detectionSensitivity
              }}
            />
          </div>
        </div>
        <GoogleConnectionPanel />
      </section>
    </div>
  );
}
