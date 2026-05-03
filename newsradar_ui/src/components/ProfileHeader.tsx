import React, { useRef } from "react";
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
    if (window.confirm("¿Estás seguro de que quieres quitar tu foto de perfil?")) {
      onImageUpdate("avatar", null);
    }
  };

  const handleRemoveBanner = () => {
    if (window.confirm("¿Estás seguro de que quieres quitar la imagen de portada?")) {
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
              title="Quitar portada"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            className="banner-action-btn"
            onClick={() => bannerInputRef.current?.click()}
            title="Cambiar fondo"
          >
            <Camera size={18} /> <span>Cambiar portada</span>
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
            
            <div 
              className="avatar-edit-overlay" 
              onClick={() => avatarInputRef.current?.click()}
              title="Cambiar foto de perfil"
            >
              <Camera size={24} color="white" />
            </div>
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
              title="Quitar foto"
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
                <CheckCircle size={16} /> Verificado
              </span>
            )}
          </div>
          <p className="profile-header-role">{roleLabel}</p>
        </div>
      </div>
    </div>
  );
};
