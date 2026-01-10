import React from 'react';
import * as Icons from 'lucide-react';

interface Props {
  name: string;
  className?: string;
}

export default function DynamicIcon({ name, className }: Props) {
  // @ts-ignore - Dynamic access to icons
  const IconComponent = Icons[name];

  if (!IconComponent) {
    // Fallback icon if name not found
    return <Icons.HelpCircle className={className} />;
  }

  return <IconComponent className={className} />;
}
