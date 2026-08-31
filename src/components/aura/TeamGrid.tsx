import { useState } from "react";

interface Member {
  name: string;
  role: string;
  bio: string;
  photo: string;
}

const TEAM: Member[] = [
  {
    name: "Theopistos",
    role: "Founder",
    bio: "Δημιουργός της μεθόδου AURA. Έχτισε ένα σύστημα που δεν διδάσκει κουρέματα αλλά τρόπο σκέψης: παρατήρηση, ανάλυση, σχεδιασμός, εκτέλεση. Ο ρόλος του είναι να κρατά το standard της Ακαδημίας ψηλά και ασυμβίβαστο.",
    photo: "/images/team/theopistos.jpg",
  },
  {
    name: "Aggelos",
    role: "Co-Founder",
    bio: "Συνιδρυτής και υπεύθυνος εκπαιδευτικής δομής. Μετατρέπει τη μέθοδο σε επίπεδα, αποστολές και μετρήσιμα κριτήρια, ώστε κάθε μαθητής να ξέρει πάντα πού βρίσκεται και ποιο είναι το επόμενο βήμα του.",
    photo: "/images/team/aggelos.jpg",
  },
  {
    name: "Manos",
    role: "Web Developer",
    bio: "Υπεύθυνος για την πλατφόρμα AURA. Χτίζει το digital operating system της Ακαδημίας — από το lesson player και τα submissions μέχρι τα πιστοποιητικά και το admin panel.",
    photo: "/images/team/manos.jpg",
  },
];

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function MemberCard({ member }: { member: Member }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_0_40px_-14px_rgba(255,255,255,0.25)]">
      <div className="mb-5 flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white/15 bg-[#171717]">
          {imageFailed ? (
            <span className="flex h-full w-full items-center justify-center text-sm font-semibold tracking-wide text-neutral-300">
              {initialsOf(member.name)}
            </span>
          ) : (
            <img
              src={member.photo}
              alt={`${member.name} — ${member.role}`}
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold tracking-wide text-neutral-100">
            {member.name}
          </h3>
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">{member.role}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-neutral-400">{member.bio}</p>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
    </article>
  );
}

export default function TeamGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {TEAM.map((member) => (
        <MemberCard key={member.name} member={member} />
      ))}
    </div>
  );
}