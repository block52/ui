import React from "react";
import styles from "./LoadingPokerIcon.module.css";

type LoadingPokerIconProps = {
    size?: number;
    color?: string;
};

const LoadingPokerIcon: React.FC<LoadingPokerIconProps> = ({ size = 60, color = "#64ffda" }) => {
    return (
        <div className="flex flex-col items-center justify-center">
            <div className="relative" style={{ width: size, height: size }}>
                {/* Spinning outer circle */}
                <div className={`absolute inset-0 animate-spin ${styles.spinSlow}`}>
                    <svg width={size} height={size} viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="2" strokeDasharray="10 5" opacity="0.7" />
                    </svg>
                </div>

                {/* Poker suits animation */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-2/3 h-2/3">
                        {/* Spade */}
                        <div className={`absolute inset-0 flex items-center justify-center ${styles.fadeInOut} ${styles.delay0}`}>
                            <span className="text-3xl" style={{ fontSize: size / 3 }}>
                                ♠️
                            </span>
                        </div>
                        {/* Heart */}
                        <div className={`absolute inset-0 flex items-center justify-center opacity-0 ${styles.fadeInOut} ${styles.delay075}`}>
                            <span className="text-3xl" style={{ fontSize: size / 3 }}>
                                ♥️
                            </span>
                        </div>
                        {/* Diamond */}
                        <div className={`absolute inset-0 flex items-center justify-center opacity-0 ${styles.fadeInOut} ${styles.delay15}`}>
                            <span className="text-3xl" style={{ fontSize: size / 3 }}>
                                ♦️
                            </span>
                        </div>
                        {/* Club */}
                        <div className={`absolute inset-0 flex items-center justify-center opacity-0 ${styles.fadeInOut} ${styles.delay225}`}>
                            <span className="text-3xl" style={{ fontSize: size / 3 }}>
                                ♣️
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <p className="mt-3 text-ink font-medium animate-pulse">Buying in...</p>
        </div>
    );
};

export default LoadingPokerIcon;
