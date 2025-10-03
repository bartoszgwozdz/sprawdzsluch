package dev.gwozdz.audiogram.service;

import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.Map;

@Service
public class HtmlService {
    private final TemplateEngine templateEngine;

    public HtmlService(TemplateEngine templateEngine)
    {
        this.templateEngine = templateEngine;
    }

    /**
     * Renderuje szablon Thymeleaf do gotowego HTML.
     *
     * @param templateName np. "report"
     * @param variables    mapa danych (np. user, report, results)
     * @return gotowy kod HTML
     */
    public String renderHtml(String templateName, Map<String, Object> variables)
    {
        Context context = new Context();
        context.setVariables(variables);
        return templateEngine.process(templateName, context);
    }
}
