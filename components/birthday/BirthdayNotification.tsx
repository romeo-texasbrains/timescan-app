'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Profile } from '@/lib/types/profile';
import { formatBirthdayMessage } from '@/lib/utils/birthdayUtils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/types/profile';
import { CakeIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BirthdayNotificationProps {
  birthdays: Profile[];
}

export default function BirthdayNotification({ birthdays }: BirthdayNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Show notification after a short delay
  useEffect(() => {
    if (birthdays.length > 0) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [birthdays]);

  // Rotate through multiple birthdays if there are more than one
  useEffect(() => {
    if (birthdays.length > 1 && isVisible) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % birthdays.length);
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [birthdays.length, isVisible]);

  // No birthdays, don't render anything
  if (birthdays.length === 0) {
    return null;
  }

  const currentBirthday = birthdays[currentIndex];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-16 left-0 right-0 z-50 flex justify-center px-4 py-2"
        >
          <div className="bg-card border border-primary/20 shadow-lg rounded-lg p-4 max-w-md w-full">
            <div className="flex items-start">
              {/* Birthday icon or user avatar */}
              <div className="mr-4 flex-shrink-0">
                <Avatar className="h-12 w-12 bg-primary/10 text-primary">
                  {currentBirthday.profile_picture_url ? (
                    <AvatarImage src={currentBirthday.profile_picture_url} alt={currentBirthday.full_name || ''} />
                  ) : (
                    <AvatarFallback>
                      {currentBirthday.full_name ? getInitials(currentBirthday.full_name) : <CakeIcon className="h-6 w-6" />}
                    </AvatarFallback>
                  )}
                </Avatar>
              </div>
              
              {/* Birthday message */}
              <div className="flex-1">
                <h3 className="font-medium text-foreground">
                  {formatBirthdayMessage(currentBirthday)}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Don't forget to wish them a happy birthday!
                </p>
              </div>
              
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full -mt-1 -mr-1"
                onClick={() => setIsVisible(false)}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Pagination dots for multiple birthdays */}
            {birthdays.length > 1 && (
              <div className="flex justify-center mt-3 space-x-1">
                {birthdays.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 w-1.5 rounded-full ${
                      index === currentIndex ? 'bg-primary' : 'bg-primary/30'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
