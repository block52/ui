import { FC } from "react";
import bitcoinLogo from "../assets/bitcoin.png";
import bitcoinBackground from "../assets/bitcoin-background.png";

const Landing: FC = () => {
    return (
        <div
            style={{
                minHeight: "100vh",
                width: "100%",
                background: `#F7931A url(${bitcoinBackground}) center / cover no-repeat`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "3rem",
                padding: "2rem",
                fontFamily: "'Stardos Stencil', 'Black Ops One', 'Special Elite', monospace",
                position: "relative",
                overflow: "hidden"
            }}
        >
            <link
                href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Stencil+Display:wght@900&family=Saira+Stencil+One&family=Allerta+Stencil&family=Sansita+Swashed:wght@900&family=Stardos+Stencil:wght@700&family=Black+Ops+One&family=Special+Elite&family=Rubik+Spray+Paint&family=Rubik+Wet+Paint&display=swap"
                rel="stylesheet"
            />

            <svg width="0" height="0" style={{ position: "absolute" }}>
                <defs>
                    <filter id="spray-paint">
                        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" />
                        <feDisplacementMap in="SourceGraphic" scale="6" />
                        <feGaussianBlur stdDeviation="0.6" />
                    </filter>
                    <filter id="spray-edges" x="-20%" y="-20%" width="140%" height="140%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" seed="3" />
                        <feDisplacementMap in="SourceGraphic" scale="4" />
                        <feComponentTransfer>
                            <feFuncA type="linear" slope="1.1" intercept="-0.05" />
                        </feComponentTransfer>
                    </filter>
                    <filter id="spray-splatter" x="-50%" y="-50%" width="200%" height="200%">
                        <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="4" seed="11" />
                        <feColorMatrix
                            values="0 0 0 0 0
                                    0 0 0 0 0
                                    0 0 0 0 0
                                    0 0 0 1.6 -0.7"
                        />
                        <feComposite in2="SourceGraphic" operator="in" />
                    </filter>
                </defs>
            </svg>

            <img
                src={bitcoinLogo}
                alt="Bitcoin"
                style={{
                    width: "560px",
                    height: "560px",
                    objectFit: "contain",
                    filter: "url(#spray-edges)"
                }}
            />

            {/* <h1
                style={{
                    fontFamily: "'Rubik Spray Paint', 'Stardos Stencil', 'Black Ops One', monospace",
                    fontSize: "clamp(3.5rem, 12vw, 9rem)",
                    fontWeight: 400,
                    color: "#000",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    margin: 0,
                    lineHeight: 1,
                    textAlign: "center"
                }}
            >
                p2p.poker
            </h1> */}
            {/*
                Prison / stencil fonts (closest free Google Fonts to MyFonts "prison" tag):
                - 'Big Shoulders Stencil Display' (tall, narrow, prison-ID stencil)
                - 'Saira Stencil One'             (clean tall stencil)
                - 'Allerta Stencil'               (uniform stencil)
                - 'Stardos Stencil'               (military stencil)
                - 'Black Ops One'                 (chunky stencil)
                Spray-style (kept for comparison): 'Rubik Spray Paint', 'Rubik Wet Paint'
            */}
            <h1
                style={{
                    fontFamily: "'Big Shoulders Stencil Display', 'Stardos Stencil', sans-serif",
                    fontSize: "clamp(4rem, 16vw, 12rem)",
                    fontWeight: 900,
                    color: "#000",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    margin: 0,
                    lineHeight: 1,
                    textAlign: "center",
                    filter: "url(#spray-edges)"
                }}
            >
                p2p.poker
            </h1>
        </div>
    );
};

export default Landing;
