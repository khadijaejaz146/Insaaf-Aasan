import { Link } from "react-router-dom";
import { ScaleIcon } from "./icons";
import Disclaimer from "./Disclaimer";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner container">
        <div className="footer__brand">
          <span className="footer__logo" aria-hidden="true">
            <ScaleIcon size={18} />
          </span>
          <span className="footer__name">Insaaf Aasan</span>
          <span className="footer__urdu urdu">انصاف آسان</span>
          <span className="footer__sep" aria-hidden="true">
            —
          </span>
          <span className="footer__tagline">Justice, explained simply.</span>
        </div>

        <Disclaimer variant="plain" />

        <div className="footer__bottom">
          <p>
            Grounded exclusively in official sources — FIA · NADRA · FOSPAH ·
            DGI&amp;P · Pakistan Code
          </p>
          <p>
            © {new Date().getFullYear()} Insaaf Aasan · <Link to="/chat">Start a complaint</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
