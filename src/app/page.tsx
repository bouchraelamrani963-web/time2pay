import LandingPage from "@/components/LandingPage";

import { registrationTrialEnabled, launchOfferAvailable } from "@/lib/registration-trial";

export const dynamic = "force-dynamic";
export default function Home() {
  return <LandingPage trialEnabled={registrationTrialEnabled()} launchOffer={launchOfferAvailable()} />;
}