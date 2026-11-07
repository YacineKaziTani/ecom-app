import { useEffect, useState, FormEvent } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { reviewsApi } from "../api/reviews";
import { useAuth } from "../store/AuthContext";
import { formatDate } from "../lib/status";
import { StarInput, StarRating } from "./StarRating";
import { Pagination } from "./Pagination";
import toast from "react-hot-toast";

export function ReviewsSection({ productId }: { productId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const { data } = useQuery({
    queryKey: ["reviews", productId, page, user?.id],
    queryFn: () => reviewsApi.list(productId, page),
  });

  // Pre-fill the form with your existing review.
  useEffect(() => {
    if (data?.mine) {
      setRating(data.mine.rating);
      setComment(data.mine.comment ?? "");
    }
  }, [data?.mine]);

  const save = useMutation({
    mutationFn: () => reviewsApi.save(productId, { rating, comment: comment || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
      qc.invalidateQueries({ queryKey: ["product", productId] });
      toast.success(t("reviews.thanks"));
    },
    onError: (err: any) => toast.error(String(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (rating === 0) return toast.error(t("reviews.chooseRating"));
    save.mutate();
  }

  return (
    <section className="mt-14 border-t border-border pt-10">
      <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
        <MessageSquare className="h-5 w-5 text-accent" />
        {t("reviews.title")} {data ? <span className="text-base font-normal text-muted-foreground">({data.total})</span> : null}
      </h2>

      {data?.canReview && (
        <form onSubmit={handleSubmit} className="card mt-6 space-y-3 p-5">
          <p className="text-sm font-semibold text-foreground">
            {data.mine ? t("reviews.update") : t("reviews.youBought")}
          </p>
          <StarInput value={rating} onChange={setRating} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={1000}
            className="textarea"
            placeholder={t("reviews.placeholder")}
          />
          <button type="submit" disabled={save.isPending} className="btn-primary">
            {data.mine ? t("reviews.updateButton") : t("reviews.post")}
          </button>
        </form>
      )}
      {!user && (
        <p className="mt-4 text-sm text-muted-foreground">{t("reviews.onlyBuyers")}</p>
      )}

      <div className="mt-6 space-y-4">
        {data?.items.length ? (
          data.items.map((r) => (
            <article key={r.id} className="border-b border-border pb-4 last:border-0">
              <div className="flex flex-wrap items-center gap-3">
                <StarRating value={r.rating} />
                <span className="text-sm font-semibold text-foreground">{r.author}</span>
                <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
              </div>
              {r.comment && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.comment}</p>}
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{t("reviews.none")}</p>
        )}
      </div>
      {data && (
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPageChange={setPage} />
      )}
    </section>
  );
}
