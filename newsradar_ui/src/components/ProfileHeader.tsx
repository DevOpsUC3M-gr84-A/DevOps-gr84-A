import React, { useRef } from "react";
import { useI18n } from "../i18n/i18n";
import { CheckCircle, Camera, Trash2 } from "lucide-react";
import "./ProfileHeader.css";

interface ProfileHeaderProps {
  firstName: string;
  lastName: string;
  roleLabel: string;
  isVerified: boolean;
  avatar?: string | null;
  banner?: string | null;
  onImageUpdate: (type: "avatar" | "banner", data: string | null) => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  firstName,
  lastName,
  roleLabel,
  isVerified,
  avatar,
  banner,
  onImageUpdate,
}) => {
  const { t } = useI18n();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "avatar" | "banner"
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // En vez de guardarlo local, avisamos al padre para que lo envíe al backend
        onImageUpdate(type, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    if (event.target) event.target.value = '';
  };

  const handleRemoveAvatar = () => {
    if (globalThis.confirm(t("profileHeader.confirmRemoveAvatar"))) {
      onImageUpdate("avatar", null);
    }
  };

  const handleRemoveBanner = () => {
    if (globalThis.confirm(t("profileHeader.confirmRemoveBanner"))) {
      onImageUpdate("banner", null);
    }
  };

  const firstInitial = firstName ? firstName.charAt(0) : "";
  const lastInitial = lastName ? lastName.charAt(0) : "";
  const initials = `${firstInitial}${lastInitial}`.toUpperCase() || "US";

  return (
    <div className="profile-header-card">
      <div
        className="profile-banner"
        style={{ backgroundImage: banner ? `url(${banner})` : undefined }}
      >
        <div className="banner-actions">
          {banner && (
            <button
              className="banner-action-btn banner-remove-btn"
              onClick={handleRemoveBanner}
              title={t("profileHeader.removeBanner")}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            className="banner-action-btn"
            onClick={() => bannerInputRef.current?.click()}
            title="Cambiar fondo"
          >
            <Camera size={18} /> <span>{t("profileHeader.changeBanner")}</span>
          </button>
        </div>
        <input
          type="file"
          hidden
          accept="image/*"
          ref={bannerInputRef}
          onChange={(e) => handleImageUpload(e, "banner")}
        />
      </div>

      <div className="profile-header-info">
        <div className="profile-avatar-wrapper">
          <div className="profile-avatar">
            {avatar ? (
              <img src={avatar} alt="Avatar" className="avatar-img" />
            ) : (
              <span className="avatar-initials">{initials}</span>
            )}
            
            <button 
              type="button"
              className="avatar-edit-overlay" 
              onClick={() => avatarInputRef.current?.click()}
              title={t("profileHeader.changeAvatar")}
              aria-label={t("profileHeader.changeAvatar")}
              style={{ border: "none", cursor: "pointer", padding: 0, width: "100%", height: "100%" }}
            >
              <Camera size={24} color="white" />
            </button>
            <input
              type="file"
              hidden
              accept="image/*"
              ref={avatarInputRef}
              onChange={(e) => handleImageUpload(e, "avatar")}
            />
          </div>
          
          {avatar && (
            <button 
              className="avatar-remove-btn" 
              onClick={handleRemoveAvatar}
              title={t("profileHeader.removeAvatar")}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <div className="profile-user-details">
          <div className="profile-name-row">
            <h1 className="profile-fullname">
              {firstName} {lastName}
            </h1>
            {isVerified && (
              <span className="header-verified-badge">
                <CheckCircle size={16} /> {t("profileHeader.verified")}
              </span>
            )}
          </div>
          <p className="profile-header-role">{roleLabel}</p>
        </div>
      </div>
    </div>
  );
};
