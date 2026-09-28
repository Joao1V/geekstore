'use client';

import { Button } from '@heroui/react';
import { ArrowLeft, ArrowRight, Flame } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import type { Swiper as SwiperInstance } from 'swiper';
import { A11y, Keyboard } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import { getMascot } from '@/lib/mascot';

const campaigns = [
  {
    tag: 'O próximo capítulo é seu',
    title: ['Seu universo.', 'Sua coleção.'],
    text: 'Colecionáveis, games e itens que contam a sua história.',
    cta: 'Encontrar meu próximo drop',
    href: '/catalogo/',
  },
  {
    tag: 'Dê um upgrade na coleção',
    title: ['Pequenos achados.', 'Grandes histórias.'],
    text: 'Explore os produtos e encontre seu próximo favorito.',
    cta: 'Explorar ofertas',
    href: '/catalogo/?ofertas=1',
  },
];

export function CampaignSlider() {
  const [slider, setSlider] = useState<SwiperInstance | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  return (
    <section
      className="hero campaign-slider"
      aria-label="Campanhas GeekStore"
      aria-roledescription="carrossel"
    >
      <Swiper
        modules={[A11y, Keyboard]}
        onSwiper={setSlider}
        onSlideChange={(s) => setActiveIndex(s.activeIndex)}
        slidesPerView={1}
        rewind
        speed={reducedMotion ? 0 : 550}
        grabCursor
        keyboard={{ enabled: true, onlyInViewport: true }}
        a11y={{
          slideLabelMessage: 'Campanha {{index}} de {{slidesLength}}',
          containerRoleDescriptionMessage: 'Carrossel de campanhas',
        }}
      >
        {campaigns.map((campaign, index) => (
          <SwiperSlide key={campaign.href} inert={activeIndex !== index}>
            <div className={`campaign-slide campaign-slide-${index}`} inert={activeIndex !== index}>
              <div className="hero-dots" />
              <div className="wrap hero-inner">
                <motion.div
                  className="hero-copy"
                  initial={false}
                  animate={{
                    opacity: activeIndex === index ? 1 : 0.4,
                    y: reducedMotion || activeIndex === index ? 0 : 18,
                  }}
                  transition={{ duration: reducedMotion ? 0 : 0.4 }}
                >
                  <p className="eyebrow yellow">
                    <Flame size={16} />
                    {campaign.tag}
                  </p>
                  {index === 0 ? (
                    <h1>
                      {campaign.title.map((line, i) => (
                        <span key={line} className={i ? 'yellow' : ''}>
                          {line}
                        </span>
                      ))}
                    </h1>
                  ) : (
                    <h2 className="campaign-title">
                      {campaign.title.map((line, i) => (
                        <span key={line} className={i ? 'yellow' : ''}>
                          {line}
                        </span>
                      ))}
                    </h2>
                  )}
                  <p>{campaign.text}</p>
                  <Link className="action" href={campaign.href}>
                    {campaign.cta}
                    <ArrowRight size={19} />
                  </Link>
                </motion.div>
                <div className="hero-mascot">
                  <div className="hero-ring" />
                  <motion.img
                    {...getMascot('hero')}
                    width={550}
                    height={550}
                    fetchPriority={index === 0 ? 'high' : 'auto'}
                    initial={false}
                    animate={{ y: activeIndex === index || reducedMotion ? 0 : 15 }}
                    transition={{ duration: reducedMotion ? 0 : 0.6 }}
                  />
                  <span className="comic-sticker">
                    Seu lado geek
                    <br />
                    merece espaço!
                  </span>
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
      <div className="wrap campaign-navigation">
        <div className="banner-controls">
          <Button isIconOnly aria-label="Banner anterior" onPress={() => slider?.slidePrev()}>
            <ArrowLeft size={18} />
          </Button>
          {campaigns.map((campaign, index) => (
            <button
              key={campaign.href}
              type="button"
              aria-label={`Banner ${index + 1}`}
              aria-pressed={activeIndex === index}
              className={`banner-dot ${activeIndex === index ? 'active' : ''}`}
              onClick={() => slider?.slideTo(index)}
            />
          ))}
          <Button isIconOnly aria-label="Próximo banner" onPress={() => slider?.slideNext()}>
            <ArrowRight size={18} />
          </Button>
          <span className="campaign-count" aria-live="polite">
            {activeIndex + 1} / {campaigns.length}
          </span>
        </div>
      </div>
    </section>
  );
}
