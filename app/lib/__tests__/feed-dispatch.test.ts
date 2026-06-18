import {
  fetchCompletionSocial,
  fetchActivitySocial,
  fetchRestSocial,
  likeCompletion,
  likeActivity,
  likeRest,
  fetchComments,
  fetchActivityComments,
  fetchRestComments,
  postRestComment,
} from "../feed";
import { commentFnsFor, likerKindFor, socialFnsFor } from "../feed-dispatch";

describe("likerKindFor", () => {
  it("maps each feed kind to its likers target kind", () => {
    expect(likerKindFor("completion")).toBe("completion");
    expect(likerKindFor("habit_created")).toBe("activity");
    expect(likerKindFor("rest")).toBe("rest");
  });
});

describe("socialFnsFor", () => {
  it("returns the completion social functions", () => {
    const fns = socialFnsFor("completion");
    expect(fns.fetch).toBe(fetchCompletionSocial);
    expect(fns.like).toBe(likeCompletion);
  });

  it("returns the activity social functions for habit_created", () => {
    const fns = socialFnsFor("habit_created");
    expect(fns.fetch).toBe(fetchActivitySocial);
    expect(fns.like).toBe(likeActivity);
  });

  it("returns the rest social functions", () => {
    const fns = socialFnsFor("rest");
    expect(fns.fetch).toBe(fetchRestSocial);
    expect(fns.like).toBe(likeRest);
  });
});

describe("commentFnsFor", () => {
  it("returns completion comment functions by default", () => {
    expect(commentFnsFor("completion").fetch).toBe(fetchComments);
  });

  it("returns activity comment functions for habit_created", () => {
    expect(commentFnsFor("habit_created").fetch).toBe(fetchActivityComments);
  });

  it("returns rest comment functions", () => {
    const fns = commentFnsFor("rest");
    expect(fns.fetch).toBe(fetchRestComments);
    expect(fns.post).toBe(postRestComment);
  });
});
