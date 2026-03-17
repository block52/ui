import React from "react";
import { useProfileAvatar } from "../../context/profile/ProfileAvatarContext";
import styles from "./ProfileAvatarButton.module.css";

interface ProfileAvatarButtonProps {
    className?: string;
    title?: string;
}

export const ProfileAvatarButton: React.FC<ProfileAvatarButtonProps> = ({ className = "", title = "Profile avatar" }) => {
    const { selectedAvatar, openDrawer } = useProfileAvatar();

    return (
        <button onClick={openDrawer} className={`${styles.avatarButton} ${className}`.trim()} title={title}>
            {selectedAvatar?.imageUrl ? (
                <img src={selectedAvatar.imageUrl} alt="Profile avatar" className={styles.avatarImage} />
            ) : (
                <span className={styles.fallbackText}>NFT</span>
            )}
        </button>
    );
};

export default ProfileAvatarButton;
