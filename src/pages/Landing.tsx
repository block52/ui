import { FC } from "react";

const Landing: FC = () => {
    return (
        <div
            style={{
                minHeight: "100vh",
                width: "100%",
                background: "#F7931A",
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
                href="https://fonts.googleapis.com/css2?family=Rubik+Spray+Paint&family=Rubik+Distressed&family=Rubik+Glitch&family=Rubik+Wet+Paint&family=Rubik+Beastly&family=Rubik+Burned&family=Rubik+Maze&family=Rubik+Marker+Hatched&family=Stardos+Stencil:wght@700&family=Black+Ops+One&family=Special+Elite&display=swap"
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

            <svg
                viewBox="0 0 200 200"
                width="280"
                height="280"
                style={{ filter: "url(#spray-edges)" }}
            >
                <circle cx="100" cy="100" r="92" fill="#000" filter="url(#spray-paint)" />
                <text
                    x="100"
                    y="142"
                    textAnchor="middle"
                    fontSize="150"
                    fontWeight="900"
                    fill="#F7931A"
                    fontFamily="'Black Ops One', sans-serif"
                    style={{ filter: "url(#spray-paint)" }}
                >
                    ₿
                </text>
                <circle cx="40" cy="50" r="3" fill="#000" filter="url(#spray-splatter)" opacity="0.6" />
                <circle cx="170" cy="60" r="2.5" fill="#000" filter="url(#spray-splatter)" opacity="0.5" />
                <circle cx="30" cy="160" r="2" fill="#000" filter="url(#spray-splatter)" opacity="0.7" />
                <circle cx="180" cy="170" r="2.8" fill="#000" filter="url(#spray-splatter)" opacity="0.55" />
            </svg>

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
                Swap fontFamily to try other spray/grunge fonts:
                - 'Rubik Spray Paint'   (clean stencil spray)
                - 'Rubik Wet Paint'     (drippy spray)
                - 'Rubik Distressed'    (distressed/worn)
                - 'Rubik Burned'        (burned edges)
                - 'Rubik Glitch'        (glitch overlay)
                - 'Rubik Maze'          (maze grunge)
                - 'Rubik Beastly'       (heavy grunge)
                - 'Rubik Marker Hatched'(hatched marker)
            */}
            <h1
                style={{
                    fontFamily: "'Rubik Wet Paint', cursive",
                    fontSize: "clamp(4rem, 14vw, 10rem)",
                    fontWeight: 400,
                    color: "#000",
                    textTransform: "lowercase",
                    letterSpacing: "0.02em",
                    margin: 0,
                    lineHeight: 1,
                    textAlign: "center"
                }}
            >
                p2p.poker
            </h1>
        </div>
    );
};

export default Landing;
