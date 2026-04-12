'use client';

import './manifesto.css';
import React, { useEffect, useState } from 'react';

export default function ManifestoPage() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="brutal-container">
      {/* HEADER METADATA */}
      <header className="brutal-section" style={{ padding: '1rem 2rem', borderBottom: '2px solid var(--brutal-muted)', display: 'flex', justifyContent: 'space-between' }}>
        <div className="brutal-mono">[ STATUS: OPERANT ]</div>
        <div className="brutal-mono">{time} // VIRAWEB_GDC</div>
        <div className="brutal-mono">PROTOCOLO: ANTI_GENERIC</div>
      </header>

      {/* HERO */}
      <section className="brutal-section" style={{ padding: '8rem 2rem' }}>
        <p className="brutal-mono brutal-accent-text" style={{ marginBottom: '1rem' }}>— O MANIFESTO</p>
        <h1 className="brutal-display">
          PARE DE<br />
          PERDER<br />
          TEMPO.
        </h1>
        <div style={{ marginTop: '4rem', maxWidth: '600px' }}>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
            O seu sistema atual é lento, burocrático e feito para te manter ocupado. 
            Nós construímos o oposto.
          </p>
        </div>
        <div style={{ marginTop: '3rem' }}>
          <a href="#" className="brutal-btn">ASSUMIR O CONTROLE →</a>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee">
        <div className="marquee-content">
          IA REAL NÃO É MODA. É EFICIÊNCIA BRUTA. — SEM DESCULPAS. — SEM FRICÇÃO. — IA REAL NÃO É MODA. É EFICIÊNCIA BRUTA. — SEM DESCULPAS. — SEM FRICÇÃO. —
        </div>
      </div>

      {/* GRID / FEATURES */}
      <section className="brutal-section" style={{ padding: 0 }}>
        <div className="brutal-grid">
          <div className="brutal-grid-item">
            <span className="brutal-mono brutal-accent-text">01. VELOCIDADE</span>
            <h2 className="brutal-h2" style={{ fontSize: '2.5rem', marginTop: '1rem' }}>ZERO<br />ESPERA.</h2>
            <p>Interfaces que respondem antes de você terminar o clique. Sem spinners bonitinhos. Só performance.</p>
          </div>
          <div className="brutal-grid-item">
            <span className="brutal-mono brutal-accent-text">02. INTELIGÊNCIA</span>
            <h2 className="brutal-h2" style={{ fontSize: '2.5rem', marginTop: '1rem' }}>DADOS,<br />NÃO OPINIÃO.</h2>
            <p>Automação que realmente entende seu cliente. Chega de dashboards que ninguém olha.</p>
          </div>
          <div className="brutal-grid-item">
            <span className="brutal-mono brutal-accent-text">03. FILOSOFIA</span>
            <h2 className="brutal-h2" style={{ fontSize: '2.5rem', marginTop: '1rem' }}>ANTIGENÉRICO.</h2>
            <p>Se você quer o que todo mundo tem, você está no lugar errado. Aqui é para quem quer dominar.</p>
          </div>
        </div>
      </section>

      {/* FINAL STATEMENT */}
      <section className="brutal-section" style={{ textAlign: 'center', padding: '10rem 2rem' }}>
        <h2 className="brutal-display" style={{ fontSize: 'clamp(3rem, 10vw, 8rem)' }}>PRONTO?</h2>
        <p className="brutal-mono" style={{ marginTop: '2rem' }}>Ou vai continuar aceitando o medíocre?</p>
        <div style={{ marginTop: '4rem' }}>
          <button className="brutal-btn" style={{ padding: '2rem 5rem', fontSize: '2rem' }}>INICIAR AGORA</button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="brutal-section" style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <p className="brutal-mono">© 2026 VIRAWEB</p>
          <p className="brutal-mono">BRAZIL // GLOBAL</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="brutal-mono">DESIGNED BY ANTIGRAVITY</p>
          <p className="brutal-mono" style={{ color: 'var(--brutal-accent)' }}>[ ANTI-SAAS REVOLUTION ]</p>
        </div>
      </footer>

      {/* CURSOR FOLLOWER EXPERIMENT */}
      <style jsx global>{`
        body {
          cursor: none;
        }
        .brutal-container:hover .custom-cursor {
          display: block;
        }
      `}</style>
      <Cursor />
    </div>
  );
}

function Cursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div 
      className="custom-cursor"
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        width: '30px',
        height: '30px',
        backgroundColor: 'var(--brutal-accent)',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 9999,
        mixBlendMode: 'difference'
      }}
    />
  );
}
