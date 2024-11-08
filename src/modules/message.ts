import { getActualUserName } from "../user/get";

    /**
     * Check new messages for questions and mentions
     */
export function checkNewMessages() {
  const messages = document.querySelectorAll('[data-test="chatUserMessageText"]');
  const actualUserName = getActualUserName();

  for (const message of messages) {
      const textContent = message.textContent;
      if (textContent) {
          // Check for questions
          if (textContent.includes('@question')) {
              const messageContainer = message.closest('.sc-leYdVB');
              messageContainer && !messageContainer.classList.contains('question-highlight') && messageContainer.classList.add('question-highlight')
          } else if (textContent.includes(`@${actualUserName}`)) {
              const messageContainer = message.closest('.sc-leYdVB');
              messageContainer && !messageContainer.classList.contains('mention-highlight') && messageContainer.classList.add('mention-highlight')
          }
      }
  }
}
