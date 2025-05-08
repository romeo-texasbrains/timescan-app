'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

// Define the properties of a single floating sprite
interface Sprite {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  rotate: number;
}

interface AnimatedBackgroundProps {
  spriteCount?: number;
  imagePath?: string;
}

export default function AnimatedBackground({
  spriteCount = 15,
  imagePath = '/logo.png'
}: AnimatedBackgroundProps) {
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1000,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  // Generate random sprites on component mount and when window resizes
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    // Add event listener for window resize
    window.addEventListener('resize', handleResize);

    // Generate sprites
    generateSprites();

    // Clean up event listener
    return () => window.removeEventListener('resize', handleResize);
  }, [windowSize.width, windowSize.height, spriteCount]);

  // Function to generate random sprites
  const generateSprites = () => {
    const newSprites: Sprite[] = [];

    // Create sprites with better distribution across the screen
    for (let i = 0; i < spriteCount; i++) {
      // Determine which half of the screen this sprite should be in
      // Ensure more sprites on the right side (60% chance)
      const isRightSide = Math.random() < 0.6;

      // Calculate x position based on which side we want the sprite
      let x;
      if (isRightSide) {
        // Right side: from 50% to 95% of screen width
        x = (0.5 + Math.random() * 0.45) * windowSize.width;
      } else {
        // Left side: from 5% to 50% of screen width
        x = (0.05 + Math.random() * 0.45) * windowSize.width;
      }

      newSprites.push({
        id: i,
        x: x,
        y: Math.random() * windowSize.height,
        size: Math.random() * 50 + 30, // Random size between 30 and 80
        duration: Math.random() * 60 + 40, // Random duration between 40 and 100 seconds
        delay: i < 10 ? 0 : Math.random() * 5, // First 10 sprites appear immediately, others within 5 seconds
        opacity: Math.random() * 0.4 + 0.3, // Random opacity between 0.3 and 0.7 (much more visible)
        rotate: Math.random() * 360 // Random initial rotation
      });
    }

    setSprites(newSprites);
  };

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {sprites.map((sprite) => (
        <motion.div
          key={sprite.id}
          className="absolute"
          initial={{
            x: sprite.x,
            y: sprite.y,
            opacity: 0,
            rotate: sprite.rotate
          }}
          animate={{
            x: [
              sprite.x,
              sprite.x + (Math.random() * 200 - 100),
              sprite.x + (Math.random() * 200 - 100),
              sprite.x + (Math.random() * 200 - 100),
              sprite.x
            ],
            y: [
              sprite.y,
              sprite.y + (Math.random() * 200 - 100),
              sprite.y + (Math.random() * 200 - 100),
              sprite.y + (Math.random() * 200 - 100),
              sprite.y
            ],
            opacity: [0, sprite.opacity, sprite.opacity, sprite.opacity, 0],
            rotate: [sprite.rotate, sprite.rotate + 180, sprite.rotate + 360]
          }}
          transition={{
            duration: sprite.duration,
            delay: sprite.delay,
            repeat: Infinity,
            ease: "easeInOut",
            times: [0, 0.25, 0.5, 0.75, 1]
          }}
        >
          <div
            style={{
              width: sprite.size,
              height: sprite.size,
              filter: `drop-shadow(0 0 8px rgba(255, 255, 255, ${sprite.opacity * 0.5}))`
            }}
            className="relative"
          >
            <Image
              src={imagePath}
              alt="Background sprite"
              fill
              sizes={`${Math.round(sprite.size)}px`}
              className="object-contain"
              style={{
                opacity: sprite.opacity,
                filter: 'saturate(1) brightness(1.5) contrast(1.2) invert(1)',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                padding: '2px'
              }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
