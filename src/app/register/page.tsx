import { trialPresentation } from "@/lib/registration-trial-policy";
import RegisterForm from "@/components/RegisterForm";
import { registrationTrialEnabled, launchOfferAvailable } from "@/lib/registration-trial";

export const dynamic = "force-dynamic";
export default function RegisterPage() {
  return <RegisterForm trialEnabled={registrationTrialEnabled()} launchOffer={launchOfferAvailable()} trialCopy={trialPresentation(registrationTrialEnabled(), process.env.TIME2PAY_LAUNCHED_AT)} />;
}
