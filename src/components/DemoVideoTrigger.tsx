"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";

export default function DemoVideoTrigger() {
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previousOverflow = useRef("");
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      videoRef.current?.pause();
      document.body.style.overflow = previousOverflow.current;
      setVideoReady(false);
      setVideoError(false);
      triggerRef.current?.focus();
    };
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("close", onClose);
      if (dialog.open) {
        dialog.close();
        document.body.style.overflow = previousOverflow.current;
      }
    };
  }, []);

  const openVideo = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    previousOverflow.current = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    setVideoReady(true);
  };

  const closeVideo = () => dialogRef.current?.close();

  const closeOnBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;
    const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
      closeVideo();
    }
  };

  return (
    <>
      <a href="#how-it-works" onClick={openVideo} ref={triggerRef} aria-haspopup="dialog" aria-controls="time2pay-demo-dialog">
        Bekijk hoe het werkt <ArrowUpRight size={17} aria-hidden="true" />
      </a>
      <dialog
        id="time2pay-demo-dialog"
        ref={dialogRef}
        onClick={closeOnBackdrop}
        aria-labelledby="time2pay-demo-title"
        aria-describedby="time2pay-demo-description"
        className="w-[min(94vw,960px)] max-w-[960px] max-h-[92dvh] overflow-y-auto rounded-xl border border-[#d9c8c7] bg-[#fffaf7] p-0 text-[#35283c] shadow-2xl backdrop:bg-[#1d111fe6]"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div>
            <h2 id="time2pay-demo-title" className="text-xl font-semibold sm:text-2xl">Zo werkt Time2Pay</h2>
            <p id="time2pay-demo-description" className="mt-1 text-sm text-[#766a73]">De schermdemo · 56 seconden</p>
          </div>
          <button
            type="button"
            onClick={closeVideo}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#d9c8c7] px-4 py-2 text-sm font-semibold hover:bg-[#f5eeeb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label="Sluit de videospeler"
          >
            Sluiten <X size={18} aria-hidden="true" />
          </button>
        </header>
        <video
          ref={videoRef}
          controls
          playsInline
          preload="none"
          src={videoReady ? "/time2pay-originele-schermdemo.mp4" : undefined}
          aria-label="Time2Pay schermdemo met Nederlandse voice-over en ondertiteling"
          className="aspect-video w-full max-h-[62dvh] bg-[#18121c] object-contain"
          onError={() => setVideoError(true)}
        >
          Je browser ondersteunt deze video niet.
        </video>
        {videoError && <p role="alert" className="px-5 pt-3 text-sm">De video kon niet worden geladen. Sluit dit venster en probeer het opnieuw.</p>}
        <footer className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <p className="text-sm font-medium">Je werk gedaan. Je factuur geregeld.</p>
          <Link
            href="/register"
            onClick={closeVideo}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#543749] px-5 py-3 text-sm font-semibold text-white hover:bg-[#3e2937] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Gratis account aanmaken <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </footer>
      </dialog>
    </>
  );
}
