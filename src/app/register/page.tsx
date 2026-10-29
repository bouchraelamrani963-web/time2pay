import RegisterForm from "@/components/RegisterForm";
import { registrationTrialEnabled, launchOfferAvailable } from "@/lib/registration-trial";

export const dynamic = "force-dynamic";
export default function RegisterPage() {
  return <RegisterForm trialEnabled={registrationTrialEnabled()} launchOffer={launchOfferAvailable()} />;
}
