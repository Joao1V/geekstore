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

const CONTROL_BUTTON = 'h-[26px] w-7 min-w-6 bg-transparent p-0 text-[#c6c4c9]';

export function CampaignSlider() {
  const [slider, setSlider] = useState<SwiperInstance | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  return (
    <section
      className="relative overflow-hidden bg-[#080809] text-white"
      aria-label="Campanhas GeekStore"
      aria-roledescription="carrossel"
    >
      <Swiper
        className="isolate w-full"
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
        {campaigns.map((campaign, index) => {
          const Heading = index === 0 ? 'h1' : 'h2';
          return (
            <SwiperSlide key={campaign.href} inert={activeIndex !== index}>
              <div
                className={`relative overflow-hidden ${index === 1 ? 'bg-[radial-gradient(ellipse_at_80%_50%,#4a2b09,#080809_65%)]' : 'bg-[#080809]'}`}
                inert={activeIndex !== index}
              >
                <div className="absolute inset-0 [background-image:radial-gradient(#ffbd0838_1px,transparent_1px),radial-gradient(ellipse_at_85%_70%,#b648143b,transparent_60%)] [background-size:18px_18px,100%_100%] [mask-image:linear-gradient(90deg,transparent,#000)]" />
                <div className="wrap relative grid min-h-[435px] grid-cols-[1.1fr_0.9fr] max-md:min-h-[340px] max-md:grid-cols-[1.2fr_0.8fr]">
                  <motion.div
                    className="relative z-2 pt-12 pb-[74px] max-md:pt-[31px] max-md:pb-16"
                    initial={false}
                    animate={{
                      opacity: activeIndex === index ? 1 : 0.4,
                      y: reducedMotion || activeIndex === index ? 0 : 18,
                    }}
                    transition={{ duration: reducedMotion ? 0 : 0.4 }}
                  >
                    <p className="eyebrow text-geek-yellow max-md:max-w-[200px]">
                      <Flame size={16} />
                      {campaign.tag}
                    </p>
                    <Heading className="font-display my-[22px] text-5xl xl:text-6xl 2xl:text-7xl leading-[0.98] tracking-[0.025em] max-md:my-[17px]">
                      {campaign.title.map((line, i) => (
                        <span key={line} className={i ? 'block text-geek-yellow' : 'block'}>
                          {line}
                        </span>
                      ))}
                    </Heading>
                    <p className="mb-[25px] max-w-[380px] text-base font-semibold text-[#bdbbc1] max-md:max-w-[210px] max-md:text-sm max-md:leading-[1.6]">
                      {campaign.text}
                    </p>
                    <Link
                      className="action max-md:min-h-[43px] max-md:px-[13px] max-md:py-[11px] max-md:text-xs max-md:[&_svg]:w-[15px]"
                      href={campaign.href}
                    >
                      {campaign.cta}
                      <ArrowRight size={19} />
                    </Link>
                  </motion.div>
                  <div className="relative flex min-w-0 items-end justify-center">
                    <div className="absolute top-[55px] size-[330px] rounded-full border border-[#ffbd0844] max-md:-left-[25px] max-md:top-[60px] max-md:size-[180px]" />
                    <motion.img
                      {...getMascot('hero')}
                      width={550}
                      height={550}
                      className="absolute bottom-0 h-[410px] w-[485px] max-w-none origin-[50%_80%] object-contain [filter:drop-shadow(0_20px_25px_#0008)] max-tablet:w-[430px] max-md:-left-7 max-md:h-[285px] max-md:w-[250px]"
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      initial={false}
                      animate={{ y: activeIndex === index || reducedMotion ? 0 : 15 }}
                      transition={{ duration: reducedMotion ? 0 : 0.6 }}
                    />
                    <span className="font-display absolute top-[55px] -right-1 z-2 rotate-[8deg] border-2 border-[#111] bg-geek-yellow px-3.5 py-2.5 text-2xl leading-none text-[#111] [box-shadow:4px_4px_#111] max-tablet:right-0 max-tablet:text-xl max-md:hidden">
                      Seu lado geek
                      <br />
                      merece espaço!
                    </span>
                  </div>
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
      <div className="wrap pointer-events-none absolute right-0 bottom-5 left-0 z-3 max-md:bottom-3.5">
        <div className="pointer-events-auto flex w-max items-center gap-[9px]">
          <Button
            isIconOnly
            className={CONTROL_BUTTON}
            aria-label="Banner anterior"
            onPress={() => slider?.slidePrev()}
          >
            <ArrowLeft size={18} />
          </Button>
          {campaigns.map((campaign, index) => (
            <button
              key={campaign.href}
              type="button"
              aria-label={`Banner ${index + 1}`}
              aria-pressed={activeIndex === index}
              className="size-[7px] min-w-[7px] rounded-full bg-[#57565b] aria-pressed:w-[26px] aria-pressed:bg-geek-yellow"
              onClick={() => slider?.slideTo(index)}
            />
          ))}
          <Button
            isIconOnly
            className={CONTROL_BUTTON}
            aria-label="Próximo banner"
            onPress={() => slider?.slideNext()}
          >
            <ArrowRight size={18} />
          </Button>
          <span className="ml-2.5 text-xs text-[#bdbbc1]" aria-live="polite">
            {activeIndex + 1} / {campaigns.length}
          </span>
        </div>
      </div>
    </section>
  );
}
