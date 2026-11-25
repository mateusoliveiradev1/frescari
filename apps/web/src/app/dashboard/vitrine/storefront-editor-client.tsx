"use client";

import { STOREFRONT_BIO_MAX_LENGTH } from "@frescari/validators";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { UploadButton } from "@/lib/uploadthing";
import {
  buildProducerStorefrontPath,
  getProducerInitials,
} from "@/lib/producer-storefront";
import { trpc } from "@/trpc/react";

type Profile = {
  name: string;
  slug: string;
  photoUrl: string | null;
  bio: string | null;
};

export function StorefrontEditorClient() {
  const { data: profile, isLoading } = trpc.storefront.getMyProfile.useQuery();

  if (isLoading || !profile) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded-sm bg-soil/10" />
        <div className="h-64 animate-pulse rounded-sm bg-soil/10" />
      </div>
    );
  }

  // Keyed by slug so the form state starts from the loaded profile.
  return <StorefrontEditorForm key={profile.slug} profile={profile} />;
}

function StorefrontEditorForm({ profile }: { profile: Profile }) {
  const utils = trpc.useUtils();
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile.photoUrl);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [isUploading, setIsUploading] = useState(false);

  const save = trpc.storefront.updateProfile.useMutation({
    onSuccess: async () => {
      toast.success("Vitrine atualizada.");
      await utils.storefront.getMyProfile.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Não foi possível salvar.");
    },
  });

  const storefrontPath = buildProducerStorefrontPath(profile.slug);
  const isDirty =
    photoUrl !== profile.photoUrl || bio.trim() !== (profile.bio ?? "");

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/70">
            Área do produtor
          </p>
          <h1 className="font-display text-4xl font-black text-soil">
            Minha vitrine
          </h1>
          <p className="max-w-xl text-sm text-bark">
            A foto e o texto aparecem na sua página publica e no cartão que o
            WhatsApp mostra quando você compartilha o link.
          </p>
        </div>
        <Link
          href={storefrontPath}
          target="_blank"
          className="shrink-0 font-sans text-sm font-semibold text-forest hover:underline"
        >
          Ver minha vitrine →
        </Link>
      </header>

      <form
        className="space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({ photoUrl, bio });
        }}
      >
        <section className="space-y-4 rounded-sm border border-soil/10 bg-white p-6">
          <div>
            <h2 className="font-display text-xl font-bold text-soil">Foto</h2>
            <p className="text-sm text-bark">
              Pode ser a fazenda, você na lavoura ou o logo do seu negócio. Uma
              foto quadrada fica melhor.
            </p>
          </div>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt="Foto da vitrine"
                className="h-28 w-28 shrink-0 rounded-full object-cover shadow-sm"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-forest font-display text-4xl font-black text-cream"
              >
                {getProducerInitials(profile.name)}
              </span>
            )}

            <div className="flex flex-col items-start gap-3">
              <UploadButton
                endpoint="storefrontPhoto"
                onUploadBegin={() => setIsUploading(true)}
                onClientUploadComplete={(result) => {
                  const url = result?.[0]?.ufsUrl ?? result?.[0]?.url;
                  if (url) {
                    setPhotoUrl(url);
                    toast.success("Foto carregada. Clique em salvar.");
                  }
                  setIsUploading(false);
                }}
                onUploadError={(error: Error) => {
                  toast.error(`Erro no upload: ${error.message}`);
                  setIsUploading(false);
                }}
                appearance={{
                  button:
                    "bg-forest hover:bg-forest/90 text-cream font-sans text-xs font-bold uppercase tracking-wider rounded-sm px-6 py-2",
                  allowedContent:
                    "text-bark/50 font-sans text-[10px] uppercase tracking-tighter mt-2",
                }}
                content={{
                  button: photoUrl ? "Trocar foto" : "Enviar foto",
                  allowedContent: "Imagem até 4MB (JPG, PNG, WebP)",
                }}
              />
              {photoUrl ? (
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="font-sans text-xs font-semibold text-bark underline-offset-2 hover:text-red-700 hover:underline"
                >
                  Remover foto
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-sm border border-soil/10 bg-white p-6">
          <div>
            <label
              htmlFor="storefront-bio"
              className="font-display text-xl font-bold text-soil"
            >
              Sobre você
            </label>
            <p className="text-sm text-bark">
              Conte em poucas linhas quem você e, o que planta e como cuida da
              produção. E o que faz o comprador confiar em você.
            </p>
          </div>
          <textarea
            id="storefront-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={STOREFRONT_BIO_MAX_LENGTH}
            rows={6}
            placeholder="Ex.: Somos a família Souza, plantamos hortaliças em Pirangi desde 1998. Colhemos de manhã e entregamos no mesmo dia."
            className="w-full rounded-sm border border-soil/15 bg-cream px-4 py-3 font-sans text-sm text-soil focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
          />
          <p className="text-right font-sans text-xs text-bark/60">
            {bio.length}/{STOREFRONT_BIO_MAX_LENGTH}
          </p>
        </section>

        <div className="flex items-center justify-end gap-4">
          {isDirty ? (
            <span className="font-sans text-xs text-bark/70">
              Alterações não salvas
            </span>
          ) : null}
          <button
            type="submit"
            disabled={!isDirty || save.isPending || isUploading}
            className="rounded-sm bg-forest px-6 py-3 font-sans text-sm font-bold uppercase tracking-wider text-cream transition-opacity hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {save.isPending ? "Salvando..." : "Salvar vitrine"}
          </button>
        </div>
      </form>
    </div>
  );
}
