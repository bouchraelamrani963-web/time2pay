import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Clock3, FileText, Users, ChartNoAxesColumnIncreasing } from "lucide-react";
import styles from "./LandingHero.module.css";
import { trialPresentation } from "@/lib/registration-trial-policy";
export default function LandingHero({ trialCopy }: { trialCopy: ReturnType<typeof trialPresentation> }) {
  const items = [[Clock3, "Uren & materialen", "Snel en eenvoudig registreren"], [FileText,"Professionele facturen","In jouw eigen huisstijl"], [Users,"Klantenbeheer","Al je klanten overzichtelijk"], [ChartNoAxesColumnIncreasing,"Betalingen & overzicht","Grip op je omzet"]] as const;
  return <section className={styles.hero}>
    <div className={styles.photo}><Image src="/images/zelfstandige-werkbus.webp" alt="Zelfstandige met een tablet bij haar werkbus" fill priority sizes="(min-width: 1024px) 64vw, 100vw" style={{objectFit:"cover",objectPosition:"45% center"}} /></div>
    <div className={styles.inner}>
      <div className={styles.copy}>
        <h1>Je werk gedaan.<br />Je factuur<br /><span>geregeld.<svg viewBox="0 0 240 30" aria-hidden="true"><path d="M8 24 Q120 -3 230 8 M70 25 Q140 5 230 8" /></svg></span></h1>
        <p className={styles.description}>Uren, materialen of vierkante meters factureren? Met Time2Pay maak je een duidelijke factuur en houd je overzicht over je klanten en betalingen.</p>
        <div className={styles.actions}><Link href="/register" className={styles.button}>Gratis account aanmaken <ArrowRight size={20}/></Link><a href="#how-it-works">Bekijk hoe het werkt <ArrowUpRight size={17}/></a></div>
        <div className={styles.campaign}><p><CalendarDays aria-hidden="true"/><strong>{trialCopy.headline}</strong></p><p><Check aria-hidden="true"/>Minimaal 30 dagen gratis vanaf registratie</p><p><Check aria-hidden="true"/>Geen automatische omzetting naar een betaald abonnement</p><details><summary>Voorwaarden gratis periode</summary><p>{trialCopy.detail}</p><p>{trialCopy.after}</p></details></div>
      </div>
      <div className={styles.visual}>
        <div className={styles.invoice}>
          <div className={styles.invoiceHead}><b>Time2Pay</b><div><strong>Factuur</strong><small>F2026-0148</small></div></div>
          <small className={styles.label}>Factuur aan</small><b>Studio Van Dijk</b>
          <dl><div><dt>Schilderwerk</dt><dd>€ 540,00</dd></div><div><dt>Materiaal</dt><dd>€ 125,00</dd></div><div className={styles.total}><dt>Totaal <small>incl. btw</small></dt><dd>€ 804,65</dd></div></dl>
          <small className={styles.example}>Illustratief voorbeeld</small>
        </div>
      </div>
    </div>
    <div className={styles.features}>{items.map(([Icon,title,description])=><div key={title}><span><Icon size={30} aria-hidden="true"/></span><div><b>{title}</b><p>{description}</p></div></div>)}</div>
  </section>;
}
