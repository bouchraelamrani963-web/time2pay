"use client";

import type { TotpSecret } from "firebase/auth";
import { QRCodeSVG } from "qrcode.react";

interface Props {
  secret: TotpSecret;
  accountName: string;
}

export default function TotpEnrollment({ secret, accountName }: Props) {
  // Encode locally: never send the enrollment URI to an external QR service.
  const enrollmentUri = secret.generateQrCodeUrl(accountName, "Time2Pay");

  return <div className="space-y-4 text-sm">
    <p>Open je authenticator-app, voeg een account toe en kies ‘QR-code scannen’. Scan deze code om Time2Pay toe te voegen.</p>
    <div className="flex justify-center rounded-lg border border-[#eadfda] bg-white p-3">
      <QRCodeSVG value={enrollmentUri} size={224} level="M" marginSize={4}
        title="Scan deze QR-code met je authenticator-app"
        role="img" aria-label="QR-code om Time2Pay aan je authenticator-app toe te voegen"
        className="h-auto w-full max-w-[224px]" />
    </div>
    <details className="rounded-lg border border-[#eadfda] p-3">
      <summary className="cursor-pointer font-medium text-[#543749]">Lukt scannen niet? Instelsleutel invoeren</summary>
      <p className="mt-3">Kies in je app ‘Instelsleutel invoeren’. Gebruik de naam Time2Pay en kies een tijdgebonden code.</p>
      <p className="mt-3">Instelsleutel (bewaar deze privé):</p>
      <code className="mt-2 block break-all rounded bg-[#fbf8f5] p-3 select-all">{secret.secretKey}</code>
    </details>
    <p>Vul hieronder de zescijferige code uit je app in om de koppeling te bevestigen.</p>
    <p>Bewaar de hersteloptie van je authenticator veilig voordat je doorgaat. Zonder toegang tot je app kun je niet inloggen. Herstel via de beheerder vereist identiteitscontrole.</p>
  </div>;
}
