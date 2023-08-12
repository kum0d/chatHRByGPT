import { Configuration, OpenAIApi } from "openai";
import fetchAdapter from '@vespaiach/axios-fetch-adapter';

export default {
	async fetch(request, env, ctx) {
		if (request.method === 'OPTIONS') {
			return new Response('accept', {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'POST',
					'Access-Control-Allow-Headers': '*',
					'Access-Control-Max-Age': '600'
				},
			});
		}
		if (request.method != 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		const contentType = request.headers.get('content-type');
		if (contentType == null || contentType == "" || !contentType.includes('application/json')) {
			return new Response('Invalid content-type', { status: 400 });
		}
		try {
			const data = await request.json();
			const message = data['message'];
			const question = data['question'];
			const role = data['role'];
			const flag = data['flag'];
			if (role == "" || role == null) {
				return new Response('Invalid value', { status: 400 });
			}
			if ((message == null || message == "") && (question == null || question == "")) {
				return new Response('Invalid value', { status: 400 });
			}
			console.log("start**************time:" + new Date());
			let result;
			if (flag == 0) {
				if (message == null || message == "") {
					console.log("reply question");
					result = await replyQuestion(env, question, role);
				}
				else if (question == null || question == "") {
					console.log("reply message");
					result = await replyMessage(env, message, role);
				}
			}
			else if (flag == 1) {
				result = await replyFunction(env, message);
			}
			console.log("end****************time:" + new Date());
			return new Response(JSON.stringify({ message: result }), {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Content-Type': 'application/json'
				},
			});
		} catch (error) {
			return new Response('Invalid JSON', { status: 400 });
		}
	},
};

async function replyQuestion(env, question, role) {
	const configuration = new Configuration({
		apiKey: env.OPENAI_API_KEY,
		baseOptions: {
			adapter: fetchAdapter
		}
	});
	const openai = new OpenAIApi(configuration);
	const content = role +
		"You need to ask <" + question + ">";
	let result;
	try {
		result = await openai.createChatCompletion({
			model: "gpt-3.5-turbo-0613",
			messages: [{
				"role": "system", "content": content
			}]
		});
		return result['data']['choices'][0]['message']['content'];
	} catch (error) {
		console.log(error);
		if (error.message == "Request failed with status code 429") {
			return "Sorry, you send too fast. Please send the message again."
		}
		return error;
	}
}

async function replyMessage(env, message, role) {
	const assistantContent = message['assistant'];
	const userContent = message['user'];
	const configuration = new Configuration({
		apiKey: env.OPENAI_API_KEY,
		baseOptions: {
			adapter: fetchAdapter
		}
	});
	const openai = new OpenAIApi(configuration);
	const content = role + "<<<If the user answered the question correctly, your response is asking the user to confirm that his answer was correct.  If the user's answer is not relevant to the question, you need to ignore the answer and tell user then re-ask the question.>>>";
	let result;
	try {
		result = await openai.createChatCompletion({
			model: "gpt-3.5-turbo-0613",
			messages: [{
				"role": "system", "content": content},
				{"role": "assistant", "content": assistantContent
			}, {
				"role": "user", "content": userContent
			}],
			functions: [{
				"name": "get_response_isRelevantOrNot",
				"description": "If the user answered the question correctly, your response is asking the user to confirm that his answer was correct.  If the user's answer is not relevant to the question, you need to ignore the answer and tell user then re-ask the question.",
				"parameters": {
					"type": "object",
					"properties": {
						"response": {
							"type": "string",
							"description": "the response you need to give to user."
						},
						"isRelevant": {
							"type": "boolean",
							"description": "If the user answered the question correctly, you need to set true. If the user's answer is not relevant to the question you need to set false"
						}
					},
					"required": ["response", "isRelevant"]
				}
			}],
			function_call: {"name": "get_response_isRelevantOrNot"}
		});
		console.log("**************result reply:" + result['data']['choices'][0]['message']['function_call']['arguments']);
		
		return result['data']['choices'][0]['message']['function_call']['arguments'];
	} catch (error) {
		console.log(error);
		if (error.message == "Request failed with status code 429") {
			return "Sorry, you send too fast. Please send the message again."
		}
		return error;
	}
}
