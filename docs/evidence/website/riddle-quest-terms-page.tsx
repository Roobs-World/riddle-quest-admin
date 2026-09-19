import type { Metadata } from "next";
import Link from "next/link";
import { SiteLayout } from "~/components/site/site-layout";

export const metadata: Metadata = {
  title: "Riddle Quest Terms of Service",
  description:
    "Terms for playing Riddle Quest: platform eligibility, fair play, virtual coins, optional purchases, refunds, and support.",
  alternates: { canonical: "https://roobsworld.com/riddle-quest/terms" },
  openGraph: {
    title: "Riddle Quest Terms of Service",
    description:
      "Terms for the Riddle Quest HTML5 game, published by Roobs World.",
    url: "https://roobsworld.com/riddle-quest/terms",
    type: "website",
  },
};

const sections = [
  {
    title: "1. About these terms",
    paragraphs: [
      "These terms apply to Riddle Quest, the HTML5 riddle and word game published by Roobs World Limited (trading as Roobs World), a company registered in England and Wales with company number 15560227, and the game services we provide. Our registered office is 3 Wherry Way, Dobwalls, Liskeard, England, PL14 4NS. In these terms, ‘we’, ‘us’ and ‘our’ mean Roobs World Limited. Contact us at grindheadgames@gmail.com about the game or these terms.",
      "Please read these terms before playing. By choosing to use Riddle Quest, you agree to them. If you do not agree, do not use the game. These terms do not replace the terms of the platform through which you play, and do not remove any rights you have under applicable consumer law. You can save or print this page for your records.",
    ],
  },
  {
    title: "2. Eligibility and platform rules",
    paragraphs: [
      "Riddle Quest has family-friendly puzzle content, but you must meet the age, account and other eligibility requirements of the platform through which you access it. A content rating is not permission to bypass those requirements. Facebook users must meet Meta’s minimum age requirement of 13, or a higher minimum where Meta or local law requires it. Do not use someone else’s account to evade an age restriction.",
      "If you are below the age at which you can enter a binding agreement where you live, your parent or legal guardian must agree to your use where that use is permitted by the host platform. Parental permission does not override a platform’s minimum age. Purchases require the payment account holder’s permission.",
    ],
  },
  {
    title: "3. Playing the game",
    paragraphs: [
      "We give you a personal, non-exclusive, non-transferable permission to play the game for entertainment in accordance with these terms. We and our licensors retain rights in the game’s code, artwork, branding and other protected content. This permission does not restrict uses that the law expressly allows.",
      "A supported browser or platform app and an internet connection may be needed. Modes, saved progress, social features, purchases and advertising can differ between platforms, devices and regions. Only features offered in your version are available to you. We do not promise that progress or purchases transfer between platforms or accounts unless the game explicitly supports it.",
    ],
  },
  {
    title: "4. Accounts, progress and fair play",
    paragraphs: [
      "Protect the account you use to access the game and tell the host platform and us if you suspect unauthorised use. Do not share passwords, payment details or authentication tokens with support. Use the game’s available save and recovery features; contact us if progress or a purchase appears to be missing.",
      "Do not harass other players, impersonate others, submit unlawful or infringing content, cheat, manipulate scores or rewards, exploit payment errors, automate gameplay to gain an unfair advantage, or interfere with the game or its security. Report suspected bugs or incorrect rewards to us rather than exploiting them. We may correct rewards obtained through fraud or a confirmed error, while respecting legitimate purchases and applicable law.",
    ],
  },
  {
    title: "5. Virtual coins and optional purchases",
    paragraphs: [
      "Coins, hints and similar items are usable within the game only. They are not money, cannot be withdrawn or exchanged for cash, and must not be sold or transferred outside supported game features. Purchasing an item gives you the right to use the described game benefit; it does not transfer ownership of the game or its intellectual property.",
      "Where purchases are enabled, the product description and the platform checkout show the benefit, price and payment currency before you authorise payment. Check those details carefully. Facebook purchases use Meta’s supported payment flow and the currency displayed in its checkout; in-game coins are separate from that payment currency. We do not ask you to pay outside the host platform’s supported checkout.",
      "Coin packs are consumed as their coins are spent. If offered, removal of interstitial ads applies to those ads for the relevant game account; it does not promise removal of every form of advertising or of the host platform’s own interface. The product description at the time of purchase determines the benefit. We will not retroactively reduce a paid entitlement contrary to that description or your legal rights.",
    ],
  },
  {
    title: "6. Purchase problems, cancellation and refunds",
    paragraphs: [
      "If a payment succeeds but the item is missing, allow the platform to finish processing, reopen the game, and contact us if it remains missing. Include the platform, product, approximate purchase time and order reference if available. Do not send full card details or account credentials. Avoid repeatedly buying the same item to resolve a delivery problem.",
      "The checkout identifies the payment provider and any applicable purchase or refund process. Use that platform’s purchase-support tools where available, or contact us for help. Platform procedures do not remove statutory rights or excuse us from responsibilities imposed by law. There is no blanket ‘no refunds’ rule under these terms.",
      "Digital content must meet applicable legal requirements, including matching its description. Where consumer law gives you a remedy for faulty or undelivered content, those rights remain. Any loss of a statutory cancellation right for immediately supplied digital content requires the consent and acknowledgement required by law; merely playing or accepting these terms is not a substitute for that process. A completed refund may remove the corresponding entitlement or reverse the related unspent coins.",
    ],
  },
  {
    title: "7. Advertising and rewards",
    paragraphs: [
      "Some versions may offer advertising or optional rewarded ads. The game will explain the reward and completion conditions when the offer is available. Rewards are credited after the provider confirms qualifying completion. Contact us about a completed offer that was not credited. Availability can depend on the platform, region and ad provider. Purchases and advertising are not offered in every version.",
    ],
  },
  {
    title: "8. Privacy and support requests",
    paragraphs: [
      "Our Privacy Policy explains how we handle personal information and how to contact us about privacy rights. The host platform also has its own privacy policy and account controls. Use available in-game or platform controls, or email grindheadgames@gmail.com, to request help with access to or deletion of your game data. We may need to verify account ownership before acting. Deleting game data can remove progress; legally required transaction records may need to be retained as explained in the Privacy Policy.",
    ],
  },
  {
    title: "9. Changes, availability and ending access",
    paragraphs: [
      "We may maintain or update the game to fix faults, protect players, meet legal requirements or improve gameplay. We cannot guarantee uninterrupted access. We will take reasonable care in providing the service and will give reasonable notice of material changes or a planned closure where practicable. Changes to paid content remain subject to the purchase description and your consumer rights.",
      "We may restrict access where reasonably necessary to address serious misuse, fraud, a security risk, a legal requirement or a material breach of these terms. Where appropriate, we will explain the reason and give an opportunity to resolve the issue. Urgent protective action may be needed first. You can stop playing at any time and contact support to question an account restriction. Ending access does not remove accrued legal rights or valid refund claims.",
      "If we change these terms, we will update the date and give appropriate notice of significant changes through an available game, platform or website channel. Changes are not retroactive and do not take away rights relating to an earlier purchase. If a change requires your agreement by law, we will obtain it.",
    ],
  },
  {
    title: "10. Responsibility and disputes",
    paragraphs: [
      "We are responsible for losses caused by our breach of these terms or failure to use reasonable care where those losses were reasonably foreseeable. Nothing in these terms excludes or limits liability for fraud, death or personal injury caused by negligence, or any other liability that cannot lawfully be excluded or limited. Your mandatory consumer rights remain unaffected.",
      "Please contact grindheadgames@gmail.com first so we can try to resolve a complaint. You retain any right to seek a remedy through the courts or other processes available under applicable law, including the protection of mandatory consumer laws and access to courts where you live when those rights apply. These terms do not require binding arbitration or waive collective remedies provided by law.",
    ],
  },
];

export default function RiddleQuestTermsPage() {
  return (
    <SiteLayout
      title="Riddle Quest Terms of Service"
      subtitle="Playing fairly, understanding purchases, and getting help."
    >
      <article
        lang="en"
        className="showcase-card space-y-8"
        style={{ overflowWrap: "anywhere" }}
      >
        <header className="space-y-3">
          <p className="text-foreground/70">
            Effective date: <time dateTime="2026-09-19">19 September 2026</time>
          </p>
          <p>Publisher: Roobs World Limited (Roobs World) · United Kingdom</p>
          <p>
            Support:{" "}
            <a className="underline" href="mailto:grindheadgames@gmail.com">
              grindheadgames@gmail.com
            </a>
          </p>
          <p>
            <Link className="underline" href="/privacy">
              Privacy Policy
            </Link>
          </p>
        </header>
        {sections.map((section) => (
          <section className="space-y-3" key={section.title}>
            <h2 className="panel-heading text-2xl">{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p className="text-foreground/80 leading-relaxed" key={paragraph}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        <footer className="border-border/70 border-t pt-5">
          <p>
            Questions about these terms?{" "}
            <a className="underline" href="mailto:grindheadgames@gmail.com">
              Contact Roobs World
            </a>
            .
          </p>
        </footer>
      </article>
    </SiteLayout>
  );
}
