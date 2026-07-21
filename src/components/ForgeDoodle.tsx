export default function ForgeDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 680 200"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ width: "100%", height: "auto" }}
    >
      <title>The Forge doodle</title>
      <desc>The Forge triangle mark is forged by a hammer, then THE FORGE letters glow hot and cool to navy.</desc>
      <defs>
        <radialGradient id="fdHot" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FFD9A0" />
          <stop offset="55%" stopColor="#F2A93B" />
          <stop offset="100%" stopColor="#E8562A" />
        </radialGradient>
      </defs>
      <style>{`
        @keyframes fdDraw{0%{stroke-dashoffset:620}100%{stroke-dashoffset:0}}
        @keyframes fdPopIn{0%{opacity:0;transform:scale(.2)}70%{opacity:1;transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}
        @keyframes fdStamp{0%{opacity:0;transform:scaleY(0)}65%{opacity:1;transform:scaleY(1.18)}100%{opacity:1;transform:scaleY(1)}}
        @keyframes fdSwing{0%,16%{transform:rotate(-10deg)}20%{transform:rotate(30deg)}24%,41%{transform:rotate(-10deg)}45%{transform:rotate(30deg)}49%,66%{transform:rotate(-10deg)}70%{transform:rotate(30deg)}74%,90%{transform:rotate(-10deg);opacity:1}100%{transform:rotate(-10deg);opacity:0}}
        @keyframes fdBurst{0%{opacity:0;transform:scale(.2)}30%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.6)}}
        @keyframes fdHeat{0%{opacity:0;fill:#E8562A;transform:translateY(-8px)}25%{opacity:1;fill:#F2A93B}100%{opacity:1;fill:#0A2540;transform:translateY(0)}}
        @keyframes fdTwinkle{0%,100%{opacity:.15;transform:scale(.6)}50%{opacity:1;transform:scale(1)}}
        .fdOutl{fill:none;stroke:#0A2540;stroke-width:5;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:620;animation:fdDraw 1s ease-out forwards}
        .fdBar{animation:fdPopIn .4s ease-out .8s both}
        .fdWL{animation:fdStamp .38s ease-out 1.65s both;transform-origin:60px 74px}
        .fdWR{animation:fdStamp .38s ease-out 2.55s both;transform-origin:60px 74px}
        .fdHammer{animation:fdSwing 3.6s ease-in-out forwards;transform-origin:0 0}
        .fdB1{animation:fdBurst .5s ease-out .78s both;transform-origin:center}
        .fdB2{animation:fdBurst .5s ease-out 1.68s both;transform-origin:center}
        .fdB3{animation:fdBurst .5s ease-out 2.58s both;transform-origin:center}
        .fdLtr{font-family:'Arial Black','Helvetica Neue',Arial,sans-serif;font-weight:900;font-size:58px;opacity:0;animation:fdHeat .9s ease-out forwards}
        .fdThe{font-family:'Arial Black',Arial,sans-serif;font-weight:900;font-size:21px;letter-spacing:7px;fill:#0A2540;opacity:0;animation:fdHeat .8s ease-out 2.45s forwards}
        .fdSpark{animation:fdTwinkle 2.8s ease-in-out infinite;transform-origin:center}
      `}</style>
      <g transform="translate(75,28)">
        <path className="fdOutl" d="M60 4 L4 132 M60 4 L116 132" />
        <g className="fdBar">
          <line x1="60" y1="16" x2="60" y2="72" stroke="#0A2540" strokeWidth="5" strokeLinecap="round" />
          <line x1="32" y1="74" x2="88" y2="74" stroke="#0A2540" strokeWidth="5" strokeLinecap="round" />
        </g>
        <polygon className="fdWL" points="34,78 58,78 58,130 22,130" fill="#0A2540" />
        <polygon className="fdWR" points="62,78 86,78 98,130 62,130" fill="#0A2540" />
        <g className="fdB1" transform="translate(60,45)">
          <g stroke="#F2A93B" strokeWidth="3" strokeLinecap="round">
            <line x1="0" y1="-14" x2="0" y2="-22" />
            <line x1="12" y1="-8" x2="18" y2="-13" />
            <line x1="14" y1="6" x2="21" y2="9" />
            <line x1="-12" y1="-8" x2="-18" y2="-13" />
            <line x1="-14" y1="6" x2="-21" y2="9" />
          </g>
        </g>
        <g className="fdB2" transform="translate(42,100)">
          <g stroke="#12B886" strokeWidth="3" strokeLinecap="round">
            <line x1="0" y1="-12" x2="0" y2="-20" />
            <line x1="11" y1="-7" x2="17" y2="-12" />
            <line x1="-11" y1="-7" x2="-17" y2="-12" />
            <line x1="13" y1="5" x2="19" y2="8" />
          </g>
        </g>
        <g className="fdB3" transform="translate(80,100)">
          <g stroke="#E8506E" strokeWidth="3" strokeLinecap="round">
            <line x1="0" y1="-12" x2="0" y2="-20" />
            <line x1="11" y1="-7" x2="17" y2="-12" />
            <line x1="-11" y1="-7" x2="-17" y2="-12" />
            <line x1="-13" y1="5" x2="-19" y2="8" />
          </g>
        </g>
        <g className="fdHammer" transform="translate(128,8)">
          <line x1="0" y1="0" x2="-26" y2="42" stroke="#5A6B82" strokeWidth="6" strokeLinecap="round" />
          <rect x="-44" y="34" width="30" height="16" rx="3" fill="#0A2540" transform="rotate(-32 -29 42)" />
        </g>
      </g>
      <line x1="242" y1="48" x2="242" y2="152" stroke="#0A2540" strokeWidth="4" opacity="0">
        <animate attributeName="opacity" to="1" dur="0.4s" begin="2.3s" fill="freeze" />
      </line>
      <text className="fdThe" x="274" y="82">THE</text>
      <text className="fdLtr" x="270" y="146" style={{ animationDelay: "2.7s" }}>F</text>
      <text className="fdLtr" x="314" y="146" style={{ animationDelay: "2.85s" }}>O</text>
      <text className="fdLtr" x="366" y="146" style={{ animationDelay: "3.0s" }}>R</text>
      <text className="fdLtr" x="416" y="146" style={{ animationDelay: "3.15s" }}>G</text>
      <text className="fdLtr" x="468" y="146" style={{ animationDelay: "3.3s" }}>E</text>
      <circle cx="524" cy="100" r="8" fill="none" stroke="#0A2540" strokeWidth="2" opacity="0">
        <animate attributeName="opacity" to="1" dur="0.4s" begin="3.6s" fill="freeze" />
      </circle>
      <circle className="fdSpark" cx="205" cy="40" r="4" fill="#F2A93B" style={{ animationDelay: "3.8s" }} />
      <circle className="fdSpark" cx="560" cy="60" r="5" fill="#2E7CF6" style={{ animationDelay: "4.2s" }} />
      <circle className="fdSpark" cx="600" cy="130" r="4" fill="#12B886" style={{ animationDelay: "4.6s" }} />
      <circle className="fdSpark" cx="180" cy="150" r="3" fill="#E8506E" style={{ animationDelay: "5s" }} />
    </svg>
  );
}
