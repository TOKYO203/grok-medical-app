import { useState, useRef } from 'react';
import { Camera } from "lucide-react";
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ProfileHeaderProps {
  name: string;
  avatarSrc: string | null;
  onAvatarFile: (file: File) => Promise<void>;
  onNameChange: (name: string) => void;
  onEditToggle: () => void;
  editing: boolean;
}

const ProfileHeader = ({ name, avatarSrc, onAvatarFile, onNameChange, onEditToggle, editing }: ProfileHeaderProps) => {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAvatarFile(file);
    }
  };

  return (
    <div className="flex items-center space-x-4">
      <div className="relative">
        <UserAvatar
          photo={avatarPreview ?? avatarSrc ?? undefined}
          className="h-20 w-20"
        />
        {editing && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute -bottom-2 -right-2 rounded-full"
            onClick={handleAvatarClick}
          >
            <Camera className="h-4 w-4" />
          </Button>
        )}
        <Input
          type="file"
          ref={avatarInputRef}
          className="hidden"
          onChange={handleFileChange}
          accept="image/*"
        />
      </div>
      <div className="flex-1">
        {editing ? (
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="text-2xl font-bold"
          />
        ) : (
          <h1 className="text-2xl font-bold">{name}</h1>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onEditToggle}
          className="mt-1"
        >
          {editing ? 'Enregistrer' : 'Modifier'}
        </Button>
      </div>
    </div>
  );
};

export default ProfileHeader;