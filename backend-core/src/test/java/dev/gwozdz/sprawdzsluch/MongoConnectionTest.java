package dev.gwozdz.sprawdzsluch;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class MongoConnectionTest {

    @Autowired
    private MongoTemplate mongoTemplate;

    @Test
    void testMongoConnection()
    {
        assertThat(mongoTemplate.getDb().getName()).isEqualTo("sprawdzsluch");
        mongoTemplate.save(new TestDocument("Test"), "Test Collection");

        assertThat(mongoTemplate.findAll(TestDocument.class, "Test Collection")
                .get(0).getValue()).isEqualTo("Test");

    }

    private static class TestDocument {
        private String value;

        public TestDocument()
        {
        }

        public TestDocument(String value)
        {
            this.value = value;
        }

        public String getValue()
        {
            return value;
        }

        public void setValue(String value)
        {
            this.value = value;
        }
    }

}