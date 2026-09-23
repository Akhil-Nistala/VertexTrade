
import Logo from "./Logo";

function Footer() {
  return (
    <footer style={{ backgroundColor: "rgb(250, 250, 250)" }}>
      <div className="container border-top mt-5">
        <div className="row mt-5">
          <div className="col">
            <Logo />
            <p className="mt-3">
              &copy; 2010 - 2024, Not VertexTrade Broking Ltd. All rights reserved.
            </p>
          </div>

          <div className="col">
            <p>Company</p>
            <a href="">About</a>
            <br />
            <a href="">Products</a>
            <br />
            <a href="">Pricing</a>
            <br />
            <a href="">Referral programme</a>
            <br />
            <a href="">Careers</a>
            <br />
            <a href="">VertexTrade.tech</a>
            <br />
            <a href="">Press & media</a>
            <br />
            <a href="">VertexTrade cares (CSR)</a>
            <br />
          </div>

          <div className="col">
            <p>Support</p>
            <a href="">Contact</a>
            <br />
            <a href="">Support portal</a>
            <br />
            <a href="">V-Connect blog</a>
            <br />
            <a href="">List of charges</a>
            <br />
            <a href="">Downloads & resources</a>
            <br />
          </div>

          <div className="col">
            <p>Account</p>
            <a href="">Open an account</a>
            <br />
            <a href="">Fund transfer</a>
            <br />
            <a href="">60 day challenge</a>
            <br />
          </div>
        </div>

        <div className="mt-5 text-muted" style={{ fontSize: "14px" }}>
          <p>
            VertexTrade Broking Ltd.: Member of NSE & BSE – SEBI Registration no.:
            INZ000031633. Depository services through VertexTrade Securities Pvt.
            Ltd. Registered Address: VertexTrade Broking Ltd. Bengaluru, Karnataka,
            India.
          </p>

          <p>
            Procedure to file a complaint on SEBI SCORES: Register on SCORES
            portal. Mandatory details for filing complaints on SCORES: Name,
            PAN, Address, Mobile Number, E-mail ID. Benefits: Effective
            Communication, Speedy redressal of the grievances.
          </p>

          <p>
            Investments in securities market are subject to market risks; read
            all the related documents carefully before investing.
          </p>

          <p>
            Prevent unauthorised transactions in your account. Update your
            mobile numbers/email IDs with your stock brokers. Receive
            information of your transactions directly from Exchange on your
            mobile/email at the end of the day. KYC is one time exercise while
            dealing in securities markets.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
