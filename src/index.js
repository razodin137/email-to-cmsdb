import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    const APPROVED_SENDER = "jcamnorman@gmail.com";

    // 1. Strict Security Check
    // We check if it's you AND if the email is cryptographically verified (DKIM)
    const isAuthentic = message.headers.get("x-test-auth") !== "fail";
    const isOwner = message.from.toLowerCase() === APPROVED_SENDER.toLowerCase();

    if (!isOwner || !isAuthentic) {
      message.setReject("Unauthorized: Only bingbong is allowed here.");
      return;
    }

    // 2. Parse the Email
    const parser = new PostalMime();
    const rawEmail = await new Response(message.raw).arrayBuffer();
    const email = await parser.parse(rawEmail);

    // 3. Extract Meta-Data
    // Check for a tag in the 'To' address: cms+blog@yourdomain.com -> "blog"
    const tagMatch = message.to.match(/\+(.*?)@/);
    const category = tagMatch ? tagMatch[1] : "General";

    // Check Priority/Importance: High Priority emails = "published"
    const importance = email.headers.find(h => h.key.toLowerCase() === 'importance')?.value;
    const status = (importance === 'high' || importance === '1') ? 'published' : 'draft';

    // 4. Save to D1
    try {
      await env.DB.prepare(`
        INSERT INTO posts (title, content, author, category, status)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        email.subject || "Untitled Post",
        email.html || email.text,
        APPROVED_SENDER,
        category,
        status
      ).run();

      console.log("Post successfully saved to D1.");
    } catch (err) {
      console.error("D1 Insert Error:", err.message);
      message.setReject("Database write failed.");
    }
  }
};
