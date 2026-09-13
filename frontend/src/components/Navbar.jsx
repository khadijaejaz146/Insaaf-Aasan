import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import "./Navbar.css";

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar__inner container">
        <Link to="/" className="navbar__brand">
          <BrandLogo className="navbar__logo" size={40} />
          <span className="navbar__name">
            Insaaf Aasan
            <span className="navbar__urdu urdu">انصاف آسان</span>
          </span>
        </Link>

        <nav className="navbar__nav" aria-label="Main">
          <Link to="/" className="navbar__link">
            Home
          </Link>
          <Link to="/chat" className="btn btn--primary btn--small navbar__cta">
            Start a complaint
          </Link>
        </nav>
      </div>
    </header>
  );
}
