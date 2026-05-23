import { ImageResponse } from 'next/og';

export const size        = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000000',
        }}
      >
        <div style={{ display: 'flex', gap: '22px', alignItems: 'center' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 62,
                height: 62,
                borderRadius: '50%',
                background: '#C8963E',
                opacity: i === 0 ? 0.5 : i === 1 ? 0.75 : 1,
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
