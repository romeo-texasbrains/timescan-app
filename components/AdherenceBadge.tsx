'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getAdherenceLabel, getAdherenceColor, getAdherenceTooltip } from '@/lib/utils/adherence-utils';
import { Database } from '@/lib/supabase/database.types';

type AdherenceStatus = Database['public']['Enums']['adherence_status'];

interface AdherenceBadgeProps {
  status: AdherenceStatus | null;
  shiftStartTime?: string | null;
  className?: string;
}

export default function AdherenceBadge({ 
  status, 
  shiftStartTime = null,
  className = ''
}: AdherenceBadgeProps) {
  const label = getAdherenceLabel(status);
  const color = getAdherenceColor(status);
  const tooltip = getAdherenceTooltip(status, shiftStartTime);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={color} className={className}>
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
